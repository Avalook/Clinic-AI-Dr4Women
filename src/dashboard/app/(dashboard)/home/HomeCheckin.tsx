"use client";

// Khu CHECK-IN trên trang chủ (thay cho mục sidebar cũ). Nút bấm → mở danh sách
// check-in HÔM NAY ngay dưới nút; bấm TÊN bệnh nhân → hồ sơ lâm sàng hiện ở cột
// PHẢI (SplitPane: kéo thanh giữa, bảng này dãn bảng kia co). Người đón khám
// (ĐD/Lễ tân/Quản lý) ghi được Sinh hiệu, các mục khác read-only.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, ChevronDown, Search, FileText, Printer } from "lucide-react";
import { fmtTime, isVnMidnight } from "../../../lib/datetime";
import { compareQueue } from "../../../lib/queue";
import SplitPane from "../SplitPane";
import ClinicalRecordForm from "../tasks/ClinicalRecordForm";
import type { DoctorApptRow } from "../tasks/DoctorWorkBoard";

export interface HomeCheckinRow extends DoctorApptRow {
  queue_number: string | null;
}

export default function HomeCheckin({
  rows,
  staffId,
}: {
  rows: HomeCheckinRow[];
  staffId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  // "Đã đến" gồm CẢ check-in (đang chờ khám) lẫn đã khám xong — vì khách thực
  // sự đã có mặt trong ngày. Lễ tân/QL nhìn số này để biết tổng khách đến.
  const arrived = rows.filter(
    (r) => r.status === "CHECKED_IN" || r.status === "COMPLETED",
  ).length;
  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => {
        const p = r.patient;
        return (
          p?.full_name.toLowerCase().includes(term) ||
          p?.patient_code.toLowerCase().includes(term) ||
          (p?.phone_primary ?? "").includes(term)
        );
      })
    : rows;
  // Thứ tự khám: ƯT lên đầu → số → theo giờ.
  const shown = [...filtered].sort(compareQueue);
  const sel = rows.find((r) => r.id === selId) ?? null;

  async function act(id: string, action: "checkin" | "undo_checkin" | "no_show") {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json()).error ?? "Có lỗi xảy ra.");
      return;
    }
    router.refresh();
  }

  const list = (
    <div className="space-y-2 p-2">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, mã BN, SĐT..."
          className="h-10 w-full rounded-lg border border-[#f3cfe0] bg-white pl-9 pr-3 text-sm text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/15"
        />
      </div>
      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-xs text-[#dc2626]">
          {error}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-[#a1a1aa]">
          {rows.length === 0
            ? "Hôm nay chưa có lịch hẹn."
            : "Không tìm thấy bệnh nhân."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const checkedIn = r.status === "CHECKED_IN";
            const completed = r.status === "COMPLETED";
            // CHỈ check-in được khi BÁC SĨ ĐÃ nhận ca (CONFIRMED). Lịch còn chờ bác
            // sĩ (SCHEDULED/CSKH_CONFIRMED) → "Chờ bác sĩ xác nhận", không check-in.
            const confirmed = r.status === "CONFIRMED";
            const active = selId === r.id;
            return (
              <li
                key={r.id}
                className={
                  "flex items-center gap-3 rounded-xl border bg-white p-2.5 " +
                  (active
                    ? "border-[#ec4899] ring-2 ring-[#ec4899]/20"
                    : completed
                      ? "border-[#e4e4e7] bg-[#fafafa]"
                      : checkedIn
                        ? "border-[#bbf7d0]"
                        : "border-[#f3cfe0]")
                }
              >
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="text-xs font-semibold text-[#171717]">
                    {isVnMidnight(r.slot_start) ? "—" : fmtTime(r.slot_start)}
                  </span>
                  {r.queue_number && (
                    <span className="mt-0.5 rounded-full bg-[#fce7f3] px-1.5 text-[10px] font-medium text-[#9d2463]">
                      {r.queue_number}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelId(r.id)}
                  className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                >
                  <FileText size={13} className="mt-0.5 shrink-0 text-[#ec4899]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#171717] hover:text-[#ec4899]">
                      {r.patient?.full_name ?? "—"}
                    </span>
                    <span className="block truncate text-[11px] text-[#888888]">
                      <span className="font-mono">{r.patient?.patient_code}</span>
                      {r.patient?.phone_primary ? ` · ${r.patient.phone_primary}` : ""}
                      {r.service?.name ? ` · ${r.service.name}` : ""}
                    </span>
                  </span>
                </button>
                {completed ? (
                  // Đã khám xong — giữ trong danh sách. Lễ tân IN PHIẾU "Tóm tắt
                  // khám bệnh" cho BN (mở tab mới → Xuất PDF). Click tên vẫn mở hồ sơ.
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[10px] font-medium text-[#52525b]">
                      Đã khám xong
                    </span>
                    <a
                      href={`/print/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#bbf7d0] bg-white px-2.5 text-xs font-semibold text-[#15803d] hover:bg-[#f0fdf4]"
                    >
                      <Printer size={13} /> In phiếu
                    </a>
                  </div>
                ) : checkedIn ? (
                  <button
                    onClick={() => act(r.id, "undo_checkin")}
                    disabled={busyId === r.id}
                    className="shrink-0 text-[11px] text-[#a1a1aa] hover:text-[#71717a] disabled:opacity-50"
                  >
                    <span className="mb-0.5 block rounded-full bg-[#dcfce7] px-2 py-0.5 text-center text-[10px] font-medium text-[#15803d]">
                      Đã check-in
                    </span>
                    Hoàn tác
                  </button>
                ) : confirmed ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => act(r.id, "checkin")}
                      disabled={busyId === r.id}
                      className="min-h-9 rounded-lg bg-[#ec4899] px-3 text-xs font-semibold text-white hover:bg-[#db2777] disabled:opacity-50"
                    >
                      {busyId === r.id ? "..." : "Check-in"}
                    </button>
                    <button
                      onClick={() => act(r.id, "no_show")}
                      disabled={busyId === r.id}
                      className="text-[11px] text-[#a1a1aa] hover:text-[#dc2626] disabled:opacity-50"
                    >
                      Không đến
                    </button>
                  </div>
                ) : (
                  // Bác sĩ CHƯA nhận ca → CHƯA check-in được; chỉ đánh "Không đến".
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-[#fef9c3] px-2.5 py-0.5 text-center text-[10px] font-medium text-[#a16207]">
                      Chờ bác sĩ xác nhận
                    </span>
                    <button
                      onClick={() => act(r.id, "no_show")}
                      disabled={busyId === r.id}
                      className="text-[11px] text-[#a1a1aa] hover:text-[#dc2626] disabled:opacity-50"
                    >
                      Không đến
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-[#f3cfe0] bg-[#fce7f3] px-4 py-2.5 text-sm font-semibold text-[#9d2463] transition-colors hover:bg-[#fbcfe8]"
      >
        <UserCheck size={16} />
        Check-in bệnh nhân
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#9d2463]">
          {arrived}/{rows.length} đã đến
        </span>
        <ChevronDown
          size={16}
          className={"ml-auto transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open &&
        (sel ? (
          // Tách đôi: danh sách (trái) + hồ sơ (phải). KHUNG CỐ ĐỊNH chiều cao,
          // mỗi cột tự cuộn ĐỘC LẬP — lăn danh sách trái KHÔNG làm panel phải nhúc
          // nhích (panel tóm tắt giữ nguyên).
          <div className="mt-3 overflow-hidden rounded-xl border border-[#f3cfe0] bg-[#fdf2f8] shadow-[0_1px_3px_rgba(236,72,153,0.08)] md:h-[78vh]">
            <SplitPane
              className="h-full"
              left={list}
              right={
                <ClinicalRecordForm
                  key={sel.id}
                  appt={sel}
                  staffId={staffId}
                  vitalsOnly
                  fill
                  onClose={() => setSelId(null)}
                />
              }
            />
          </div>
        ) : (
          <div className="mt-3 overflow-auto rounded-xl border border-[#f3cfe0] bg-[#fdf2f8] shadow-[0_1px_3px_rgba(236,72,153,0.08)] md:h-[78vh]">
            {list}
          </div>
        ))}
    </section>
  );
}
