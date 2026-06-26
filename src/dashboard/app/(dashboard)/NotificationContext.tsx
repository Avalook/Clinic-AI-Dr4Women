"use client";

// Phát hiện thông báo lịch làm việc CHẠY NỀN toàn app (gắn Provider ở layout) để
// dù đang ở trang nào cũng biết khi ca của mình được duyệt / từ chối. State chia
// sẻ qua context cho 2 nơi tiêu thụ:
//   - RosterBell (chỉ render ở Trang chủ): chuông + dropdown + popup ngắn.
//   - Nav (sidebar): chấm "!" đỏ nhấp nháy trên mục Trang chủ khi đang ở trang khác.
// Phát hiện bằng realtime (UPDATE work_roster của staff_id mình) + poll 20s dự
// phòng. Lần nạp đầu chỉ ghi nhận trạng thái (không báo) để khỏi spam ca cũ.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../lib/supabase-browser";
import {
  STATION_LABEL,
  SHIFT_LABEL,
  dayShort,
  fmtDayMonth,
  type Shift,
} from "../../lib/roster";

const POLL_MS = 20_000;
const TRANSIENT_MS = 7000;
const MAX_KEEP = 40;

export interface Notif {
  key: string;
  approved: boolean;
  title: string;
  detail: string;
  at: string; // giờ nhận, "HH:MM"
}

interface MyRow {
  id: string;
  work_date: string;
  station: string;
  shift: Shift;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
}

interface NotificationCtx {
  notifs: Notif[];
  unread: number;
  transient: Notif[];
  markAllRead: () => void;
  dismissTransient: (key: string) => void;
}

const Ctx = createContext<NotificationCtx>({
  notifs: [],
  unread: 0,
  transient: [],
  markAllRead: () => {},
  dismissTransient: () => {},
});

export const useNotifications = () => useContext(Ctx);

export function NotificationProvider({
  staffId,
  children,
}: {
  staffId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [transient, setTransient] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  const lastStatus = useRef<Map<string, MyRow["status"]>>(new Map());
  const seeded = useRef(false);
  const shownKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!staffId) return;
    const supabase = getSupabaseBrowser();
    let stopped = false;

    function label(r: MyRow) {
      const st = STATION_LABEL[r.station] ?? r.station;
      const sh = r.shift !== "FULL" ? ` (${SHIFT_LABEL[r.shift]})` : "";
      return `${dayShort(r.work_date)} ${fmtDayMonth(r.work_date)} · ${st}${sh}`;
    }

    function notify(r: MyRow) {
      if (r.status !== "APPROVED" && r.status !== "REJECTED") return;
      const key = `${r.id}:${r.status}`;
      if (shownKeys.current.has(key)) return;
      shownKeys.current.add(key);
      const approved = r.status === "APPROVED";
      const now = new Date();
      const at = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      const n: Notif = {
        key,
        approved,
        title: approved ? "Ca làm việc đã được chấp nhận" : "Ca làm việc bị từ chối",
        detail: approved
          ? label(r)
          : `${label(r)}${r.reject_reason ? " — Lý do: " + r.reject_reason : ""}`,
        at,
      };
      setNotifs((l) => [n, ...l].slice(0, MAX_KEEP));
      setUnread((u) => u + 1);
      setTransient((t) => [...t, n]);
      setTimeout(() => {
        if (!stopped) setTransient((t) => t.filter((x) => x.key !== key));
      }, TRANSIENT_MS);
    }

    async function fetchAndDiff() {
      const { data } = await supabase
        .from("work_roster")
        .select("id, work_date, station, shift, status, reject_reason")
        .eq("staff_id", staffId)
        .limit(200);
      if (stopped) return;
      const rows = (data as MyRow[] | null) ?? [];
      if (!seeded.current) {
        for (const r of rows) lastStatus.current.set(r.id, r.status);
        seeded.current = true;
        return;
      }
      for (const r of rows) {
        const prev = lastStatus.current.get(r.id);
        if (prev !== r.status) {
          lastStatus.current.set(r.id, r.status);
          if (prev === "PENDING") notify(r);
        }
      }
    }

    void fetchAndDiff();
    const poll = setInterval(fetchAndDiff, POLL_MS);

    const channel = supabase
      .channel("roster-my-decisions")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "work_roster",
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          const r = payload.new as MyRow;
          const prev = lastStatus.current.get(r.id);
          lastStatus.current.set(r.id, r.status);
          if (prev === "PENDING" || (!prev && r.status !== "PENDING")) {
            notify(r);
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      stopped = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [staffId, router]);

  return (
    <Ctx.Provider
      value={{
        notifs,
        unread,
        transient,
        markAllRead: () => setUnread(0),
        dismissTransient: (key) =>
          setTransient((t) => t.filter((x) => x.key !== key)),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
