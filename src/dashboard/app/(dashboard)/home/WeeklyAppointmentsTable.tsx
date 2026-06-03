// Bảng "Lịch hẹn khám (check đặt lịch)" trên trang chủ — form theo file Check đặt
// lịch: gom theo NGÀY, mỗi ngày 1 bảng cột Khung giờ · Số khám · Bác sĩ · Thông tin
// BN · Dịch vụ. Read-only, data từ appointment (server fetch ở home/page.tsx).
// (File gốc còn cột "Phân loại khám" = Tái khám/Khám lần đầu — chưa lưu trong DB,
//  tạm thay bằng Dịch vụ.)

import { fmtTimeOrNone } from "../../../lib/datetime";
import { dayLabel, fmtDayMonth } from "../../../lib/roster";

export interface WeekApptRow {
  id: string;
  slot_start: string;
  queue_number: string | null;
  patient: { full_name: string; patient_code: string; phone_primary: string | null } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}
export interface ApptDay {
  date: string;
  items: WeekApptRow[];
}

export default function WeeklyAppointmentsTable({ days }: { days: ApptDay[] }) {
  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div
          key={day.date}
          className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center gap-2 border-b border-[#e4e4e7] bg-[#fafafa] px-3 py-2">
            <span className="text-sm font-semibold text-[#171717]">
              {dayLabel(day.date)} · {fmtDayMonth(day.date)}
            </span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-[#71717a]">
              {day.items.length} lịch
            </span>
          </div>

          {day.items.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[#a1a1aa]">Không có lịch</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-[#71717a]">
                    <th className="border-b border-[#e4e4e7] px-3 py-1.5 text-left font-semibold">Khung giờ</th>
                    <th className="border-b border-[#e4e4e7] px-3 py-1.5 text-left font-semibold">Số khám</th>
                    <th className="border-b border-[#e4e4e7] px-3 py-1.5 text-left font-semibold">Bác sĩ</th>
                    <th className="border-b border-[#e4e4e7] px-3 py-1.5 text-left font-semibold">Thông tin BN</th>
                    <th className="border-b border-[#e4e4e7] px-3 py-1.5 text-left font-semibold">Dịch vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {day.items.map((a) => (
                    <tr key={a.id} className="border-b border-[#f4f4f5] last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-1.5 text-[#171717]">{fmtTimeOrNone(a.slot_start)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-[#52525b]">{a.queue_number ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-[#52525b]">{a.doctor?.full_name ?? "—"}</td>
                      <td className="px-3 py-1.5 text-[#171717]">
                        <span className="block">{a.patient?.full_name ?? "—"}</span>
                        <span className="block font-mono text-[11px] text-[#888888]">
                          {a.patient?.patient_code}
                          {a.patient?.phone_primary ? ` · ${a.patient.phone_primary}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-[#52525b]">{a.service?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
