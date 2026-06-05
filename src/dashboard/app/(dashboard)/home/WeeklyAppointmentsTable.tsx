// Bảng "Lịch hẹn khám (check đặt lịch)" — TÁI CẤU TRÚC theo yêu cầu: THỜI GIAN
// nằm ở CÁC HÀNG (mỗi dòng = 1 lịch hẹn, sắp theo giờ), còn KHUNG GIỜ · SỐ · BÁC
// SĨ · THÔNG TIN · PHÂN LOẠI KHÁM là CÁC CỘT. Gom theo ngày: mỗi ngày 1 dòng tiêu
// đề, dưới là các lịch của ngày đó. Read-only, data thật từ appointment (giờ/số
// phần lớn trống → "Chưa có giờ"/"—", KHÔNG bịa). Khung kéo co dãn + cuộn.

import { Fragment } from "react";
import { fmtTimeOrNone } from "../../../lib/datetime";
import { dayLabel, fmtDayMonth } from "../../../lib/roster";
import { compareQueue } from "../../../lib/queue";

export interface WeekApptRow {
  id: string;
  slot_start: string;
  queue_number: string | null;
  phan_loai: string; // "Tái khám" | "Khám lần đầu" | "" (suy từ lịch sử hẹn)
  patient: {
    clinic_patient_id: string;
    full_name: string;
    patient_code: string;
    phone_primary: string | null;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}
export interface ApptDay {
  date: string;
  items: WeekApptRow[];
}

const NO_DOCTOR = "Chưa phân bác sĩ";

// "BS Thành" / "BS SA Thành" → "THÀNH" (bỏ tiền tố chức danh, in hoa như sheet).
function cleanDoctor(name: string): string {
  return name.replace(/^(BS\s*SA|BS|ĐD|TL)\s+/i, "").trim().toUpperCase();
}

function PhanLoai({ value }: { value: string }) {
  if (!value) return <span className="text-[#c9a3b8]">—</span>;
  const first = value === "Khám lần đầu";
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " +
        (first ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef3c7] text-[#b45309]")
      }
    >
      {value}
    </span>
  );
}

// Ô thân chung (viền lưới + padding gọn).
const CELL = "border-b border-r border-[#f3cfe0] px-2 py-1.5 align-top";
// Tiêu đề cột.
const TH =
  "border-b border-r border-[#f3cfe0] px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#9d2463]";

export default function WeeklyAppointmentsTable({ days }: { days: ApptDay[] }) {
  // Cả tuần KHÔNG có lịch → thẻ rỗng GỌN (không dựng bảng trống huơ).
  if (days.every((d) => d.items.length === 0)) {
    return (
      <div className="rounded-xl border border-dashed border-[#f3cfe0] bg-white px-4 py-10 text-center text-sm text-[#c084a8] shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
        Chưa có lịch hẹn nào trong tuần này.
      </div>
    );
  }

  return (
    <div className="resize overflow-auto rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)] max-h-[88vh] min-h-[180px] max-w-full">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#fce7f3]">
            <th className={`${TH} min-w-[78px]`}>Khung giờ</th>
            <th className={`${TH} min-w-[52px]`}>Số</th>
            <th className={`${TH} min-w-[120px]`}>Bác sĩ</th>
            <th className={`${TH} min-w-[200px]`}>Thông tin</th>
            <th className={`${TH} min-w-[110px]`}>Phân loại khám</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            // Thứ tự khám: ƯT lên đầu → số → theo giờ (compareQueue).
            const items = [...day.items].sort(compareQueue);
            return (
              <Fragment key={day.date}>
                {/* Dòng tiêu đề NGÀY (gộp cả 5 cột). */}
                <tr className="bg-[#fdf2f8]">
                  <td
                    colSpan={5}
                    className="border-b border-[#f3cfe0] border-l-[3px] border-l-[#f3a8cc] px-2 py-1.5 text-sm font-semibold text-[#9d2463]"
                  >
                    {dayLabel(day.date)} · {fmtDayMonth(day.date)}
                    <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#c084a8]">
                      {items.length} lịch
                    </span>
                  </td>
                </tr>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-[#f3cfe0] px-3 py-2 text-center text-[11px] text-[#c9c9cf]"
                    >
                      — chưa có lịch —
                    </td>
                  </tr>
                ) : (
                  items.map((a, i) => (
                    <tr key={a.id} className={i % 2 ? "bg-[#fdf7fb]" : "bg-white"}>
                      <td className={`${CELL} whitespace-nowrap text-[#171717]`}>
                        {fmtTimeOrNone(a.slot_start)}
                      </td>
                      <td className={`${CELL} whitespace-nowrap text-center text-[#52525b]`}>
                        {a.queue_number ?? "—"}
                      </td>
                      <td className={`${CELL} whitespace-nowrap font-medium text-[#b83280]`}>
                        {a.doctor?.full_name
                          ? `BS. ${cleanDoctor(a.doctor.full_name)}`
                          : NO_DOCTOR}
                      </td>
                      <td className={`${CELL} text-[#171717]`}>
                        <span className="block">{a.patient?.full_name ?? "—"}</span>
                        <span className="block font-mono text-[10px] text-[#888888]">
                          {a.patient?.patient_code}
                          {a.patient?.phone_primary
                            ? ` · ${a.patient.phone_primary}`
                            : ""}
                          {a.service?.name ? ` · ${a.service.name}` : ""}
                        </span>
                      </td>
                      <td className={CELL}>
                        <PhanLoai value={a.phan_loai} />
                      </td>
                    </tr>
                  ))
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
