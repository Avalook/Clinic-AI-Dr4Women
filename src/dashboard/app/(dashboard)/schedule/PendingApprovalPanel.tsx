"use client";

// "Chờ duyệt" — hàng đợi ca tự đăng ký cho quản lý (chỉ admin thấy, xem
// schedule/page.tsx). Mỗi dòng có nút Duyệt / Từ chối → PATCH /api/roster rồi
// router.refresh() nạp lại từ server. Ca chỉ lên lịch chung khi được Duyệt.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  STATION_LABEL,
  SHIFT_LABEL,
  dayShort,
  fmtDayMonth,
  type Shift,
} from "../../../lib/roster";

export interface PendingRow {
  id: string;
  work_date: string;
  station: string;
  shift: Shift;
  staff_name: string;
}

export default function PendingApprovalPanel({ rows }: { rows: PendingRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // id ca đang mở ô nhập lý do từ chối + nội dung lý do theo từng id.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function decide(id: string, action: "approve" | "reject", reasonText?: string) {
    setError(null);
    setBusyId(id);
    const res = await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, reason: reasonText }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json()).error ?? "Lỗi khi duyệt.");
      return;
    }
    setRejectingId(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#854d0e]">
        Chờ duyệt
        <span className="rounded-full bg-[#fde68a] px-2 py-0.5 text-xs font-medium text-[#854d0e]">
          {rows.length}
        </span>
      </h2>

      {error && (
        <p className="mb-2 rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </p>
      )}

      <ul className="divide-y divide-[#fde68a]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-[#4d4d4d]">
                <span className="font-medium text-[#171717]">{r.staff_name}</span>
                {" · "}
                {dayShort(r.work_date)} · {fmtDayMonth(r.work_date)} ·{" "}
                {STATION_LABEL[r.station] ?? r.station}
                {r.shift !== "FULL" && (
                  <span className="text-[#a1a1aa]"> ({SHIFT_LABEL[r.shift]})</span>
                )}
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => decide(r.id, "approve")}
                  disabled={busyId === r.id}
                  className="flex items-center gap-1 rounded-md bg-[#16a34a] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#15803d] disabled:opacity-50"
                >
                  <Check size={14} /> Duyệt
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setReason("");
                    setRejectingId(rejectingId === r.id ? null : r.id);
                  }}
                  disabled={busyId === r.id}
                  aria-label="Từ chối"
                  className="flex items-center gap-1 rounded-md border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-50"
                >
                  <X size={14} /> Từ chối
                </button>
              </span>
            </div>

            {/* Ô nhập lý do — chỉ hiện khi bấm "Từ chối" ca này. */}
            {rejectingId === r.id && (
              <div className="rounded-lg border border-[#fde68a] bg-white p-2">
                <label className="mb-1 block text-xs font-medium text-[#854d0e]">
                  Lý do từ chối (gửi cho người đăng ký)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="VD: Ca này đã đủ người / trùng lịch khác…"
                  className="w-full resize-none rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-sm focus:border-[#ec4899] focus:outline-none"
                />
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setReason("");
                    }}
                    className="rounded-md border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs text-[#4d4d4d] hover:bg-[#f4f4f5]"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={() => decide(r.id, "reject", reason)}
                    disabled={busyId === r.id || !reason.trim()}
                    className="rounded-md bg-[#dc2626] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#b91c1c] disabled:opacity-50"
                  >
                    Xác nhận từ chối
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
