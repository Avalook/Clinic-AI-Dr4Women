"use client";

// "Cập nhật liên tục" cho bảng "Trạng thái BN buổi khám hôm nay" (Lễ tân).
// Subscribe mọi thay đổi trên bảng ``visit`` (OPEN → IN_PROGRESS → FINALIZED…) →
// debounce → ``router.refresh()`` để server component nạp lại trạng thái mới +
// PostgREST lo join patient/bác sĩ/dịch vụ. Pill nhỏ báo kênh đang sống.
// Cùng khuôn với AppointmentsRealtime (không mirror row vào client state).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../../lib/supabase-browser";

const REFRESH_DEBOUNCE_MS = 1500;

export default function VisitStatusRealtime() {
  const router = useRouter();
  const [eventCount, setEventCount] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("visit-status-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit" },
        () => {
          setEventCount((c) => c + 1);
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => {
            router.refresh();
          }, REFRESH_DEBOUNCE_MS);
        },
      )
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#71717a]">
      <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      Cập nhật liên tục
      {eventCount > 0 && (
        <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800">
          +{eventCount}
        </span>
      )}
    </span>
  );
}
