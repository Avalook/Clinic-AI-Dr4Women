"use client";

// Toast góc trên-phải báo khi ca tự đăng ký của TÔI được quản lý duyệt / từ chối.
// Gắn ở (dashboard)/layout.tsx → chạy cho MỌI vai trò, MỌI trang (đang ở /home mà
// quản lý duyệt ở máy khác vẫn nhận được). Cơ chế kép cho chắc:
//   - Realtime postgres_changes (UPDATE work_roster của staff_id mình) → tức thời.
//   - Poll 20s (lưới an toàn nếu bảng chưa bật replication) → so trạng thái đã thấy.
// Lần nạp đầu CHỈ ghi nhận trạng thái hiện tại (không toast) để khỏi spam ca cũ.

import { useEffect, useRef, useState } from "react";
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

interface MyRow {
  id: string;
  work_date: string;
  station: string;
  shift: Shift;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
}

interface Toast {
  key: string;
  approved: boolean;
  title: string;
  detail: string;
}

export default function RosterNotifier({ staffId }: { staffId: string | null }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Trạng thái lần trước theo id (để phát hiện chuyển sang APPROVED/REJECTED).
  const lastStatus = useRef<Map<string, MyRow["status"]>>(new Map());
  const seeded = useRef(false);
  // Tránh toast trùng giữa realtime và poll.
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

    function pushToast(r: MyRow) {
      if (r.status !== "APPROVED" && r.status !== "REJECTED") return;
      const key = `${r.id}:${r.status}`;
      if (shownKeys.current.has(key)) return;
      shownKeys.current.add(key);
      const approved = r.status === "APPROVED";
      const toast: Toast = {
        key,
        approved,
        title: approved ? "Ca làm việc đã được chấp nhận" : "Ca làm việc bị từ chối",
        detail: approved
          ? label(r)
          : `${label(r)}${r.reject_reason ? " — Lý do: " + r.reject_reason : ""}`,
      };
      setToasts((t) => [...t, toast]);
      // Tự ẩn sau 9s.
      setTimeout(() => {
        if (!stopped) setToasts((t) => t.filter((x) => x.key !== key));
      }, 9000);
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
        // Lần đầu: chỉ ghi nhận, không toast.
        for (const r of rows) lastStatus.current.set(r.id, r.status);
        seeded.current = true;
        return;
      }
      for (const r of rows) {
        const prev = lastStatus.current.get(r.id);
        if (prev !== r.status) {
          lastStatus.current.set(r.id, r.status);
          if (prev === "PENDING") pushToast(r); // chỉ báo khi quản lý vừa quyết
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
            pushToast(r);
            router.refresh(); // cập nhật bảng đăng ký nếu đang xem /schedule
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

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.key}
          className={
            "rounded-xl border p-3 shadow-lg " +
            (t.approved
              ? "border-[#bbf7d0] bg-[#f0fdf4]"
              : "border-[#fecaca] bg-[#fef2f2]")
          }
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={
                "text-sm font-semibold " +
                (t.approved ? "text-[#166534]" : "text-[#b91c1c]")
              }
            >
              {t.title}
            </p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.key !== t.key))}
              aria-label="Đóng"
              className="text-[#a1a1aa] hover:text-[#71717a]"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-[#4d4d4d]">{t.detail}</p>
        </div>
      ))}
    </div>
  );
}
