"use client";

// CHUÔNG THÔNG BÁO LỊCH (góc trên-phải, mọi vai trò) — gắn ở (dashboard)/layout.
// Khi quản lý DUYỆT / TỪ CHỐI ca tự đăng ký của TÔI:
//   - hiện 1 "popup ngắn" (toast) tự ẩn sau ~7s — liếc nhanh, không chiếm chỗ;
//   - đồng thời cộng vào chuông (badge số chưa đọc) để bấm xem lại kỹ sau.
// Phát hiện thay đổi bằng 2 đường: realtime (UPDATE work_roster của staff_id mình)
// + poll 20s dự phòng (nếu bảng chưa bật replication). Lần nạp đầu chỉ ghi nhận
// trạng thái hiện tại (không báo) để khỏi spam ca cũ.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X } from "lucide-react";
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

interface MyRow {
  id: string;
  work_date: string;
  station: string;
  shift: Shift;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
}

interface Notif {
  key: string;
  approved: boolean;
  title: string;
  detail: string;
  at: string; // giờ nhận, "HH:MM"
}

export default function RosterNotifier({ staffId }: { staffId: string | null }) {
  const router = useRouter();
  const [list, setList] = useState<Notif[]>([]); // lịch sử (xem lại trong chuông)
  const [transient, setTransient] = useState<Notif[]>([]); // popup ngắn
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

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
      setList((l) => [n, ...l].slice(0, MAX_KEEP));
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

  if (!staffId) return null;

  return (
    <>
      {/* Chuông + danh sách (bấm xem lại kỹ sau) */}
      <div className="fixed right-4 top-3 z-[70]">
        <button
          onClick={() => {
            setOpen((o) => !o);
            setUnread(0);
          }}
          aria-label="Thông báo lịch làm việc"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#4d4d4d] shadow-sm hover:bg-[#f4f4f5]"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ec4899] px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#f4f4f5] px-3 py-2">
              <span className="text-sm font-semibold text-[#171717]">
                Thông báo lịch làm việc
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="text-[#a1a1aa] hover:text-[#71717a]"
              >
                <X size={15} />
              </button>
            </div>
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#a1a1aa]">
                Chưa có thông báo nào.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-[#f4f4f5] overflow-auto">
                {list.map((n) => (
                  <li key={n.key} className="flex gap-2 px-3 py-2">
                    <span
                      className={
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full " +
                        (n.approved
                          ? "bg-[#dcfce7] text-[#166534]"
                          : "bg-[#fee2e2] text-[#dc2626]")
                      }
                    >
                      {n.approved ? <Check size={12} /> : <X size={12} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#171717]">{n.title}</p>
                      <p className="text-xs text-[#4d4d4d]">{n.detail}</p>
                      <p className="text-[10px] text-[#a1a1aa]">{n.at}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Popup ngắn (toast) — liếc nhanh rồi tự ẩn. Nằm dưới chuông. */}
      {transient.length > 0 && (
        <div className="fixed right-4 top-14 z-[65] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {transient.map((t) => (
            <div
              key={t.key}
              className={
                "rounded-xl border p-3 shadow-lg " +
                (t.approved
                  ? "border-[#bbf7d0] bg-[#f0fdf4]"
                  : "border-[#fecaca] bg-[#fef2f2]")
              }
            >
              <p
                className={
                  "text-sm font-semibold " +
                  (t.approved ? "text-[#166534]" : "text-[#b91c1c]")
                }
              >
                {t.title}
              </p>
              <p className="mt-1 text-xs text-[#4d4d4d]">{t.detail}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
