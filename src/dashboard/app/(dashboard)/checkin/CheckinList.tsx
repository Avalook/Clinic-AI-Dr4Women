"use client";

// Danh sách check-in hôm nay: ô tìm nhanh + thẻ từng BN với nút Check-in /
// Hoàn tác. Gọi PATCH /api/appointments rồi router.refresh().

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Check } from "lucide-react";
import { fmtTime, isVnMidnight } from "../../../lib/datetime";

export interface CheckinRow {
  id: string;
  clinic_patient_id: string;
  queue_number: string | null;
  slot_start: string;
  status: string;
  patient: {
    full_name: string;
    phone_primary: string | null;
    patient_code: string;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

export default function CheckinList({ rows }: { rows: CheckinRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const arrived = rows.filter((r) => r.status === "CHECKED_IN").length;

  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) => {
        const p = r.patient;
        return (
          p?.full_name.toLowerCase().includes(term) ||
          p?.patient_code.toLowerCase().includes(term) ||
          (p?.phone_primary ?? "").includes(term)
        );
      })
    : rows;

  async function act(id: string, action: "checkin" | "undo_checkin") {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? "Có lỗi xảy ra.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Tổng quan + tìm */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-[#52525b]">
          <span className="font-semibold text-[#171717]">{arrived}</span> đã đến
          {" / "}
          <span className="font-semibold text-[#171717]">{rows.length}</span> lịch
          hôm nay
        </span>
      </div>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, mã BN, hoặc SĐT..."
          className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white pl-9 pr-3 text-base text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/15 sm:h-10 sm:text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-10 text-center text-sm text-[#888888]">
          {rows.length === 0
            ? "Hôm nay chưa có lịch hẹn."
            : "Không tìm thấy bệnh nhân phù hợp."}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const checkedIn = r.status === "CHECKED_IN";
            return (
              <li
                key={r.id}
                className={
                  "flex items-center gap-3 rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] " +
                  (checkedIn ? "border-[#bbf7d0]" : "border-[#e4e4e7]")
                }
              >
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span
                    className="text-sm font-semibold text-[#171717]"
                    title={isVnMidnight(r.slot_start) ? "Chưa có giờ" : undefined}
                  >
                    {isVnMidnight(r.slot_start) ? "—" : fmtTime(r.slot_start)}
                  </span>
                  {r.queue_number && (
                    <span className="mt-0.5 rounded-full bg-[#f4f4f5] px-1.5 text-[10px] font-medium text-[#71717a]">
                      STT {r.queue_number}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${r.clinic_patient_id}`}
                    className="font-medium text-[#171717] hover:text-[#ec4899] hover:underline"
                  >
                    {r.patient?.full_name ?? "—"}
                  </Link>
                  <p className="truncate text-xs text-[#888888]">
                    <span className="font-mono">{r.patient?.patient_code}</span>
                    {r.patient?.phone_primary ? ` · ${r.patient.phone_primary}` : ""}
                    {r.service?.name ? ` · ${r.service.name}` : ""}
                    {r.doctor?.full_name ? ` · BS ${r.doctor.full_name}` : ""}
                  </p>
                </div>

                {checkedIn ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-medium text-[#15803d]">
                      <Check size={13} /> Đã đến
                    </span>
                    <button
                      onClick={() => act(r.id, "undo_checkin")}
                      disabled={busyId === r.id}
                      className="text-[11px] text-[#a1a1aa] hover:text-[#71717a] disabled:opacity-50"
                    >
                      Hoàn tác
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => act(r.id, "checkin")}
                    disabled={busyId === r.id}
                    className="min-h-10 shrink-0 rounded-lg bg-[#ec4899] px-4 text-sm font-semibold text-white hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-50"
                  >
                    {busyId === r.id ? "..." : "Check-in"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
