// Bảng "Lịch hẹn khám (check đặt lịch)" — form Y HỆT file Excel "Check đặt lịch":
// mỗi NGÀY 1 khối; trong ngày GOM THEO BÁC SĨ (đúng như sheet để mỗi bác sĩ 1 cụm
// cột); mỗi cụm có 4 cột Khung giờ · Số khám · Thông tin · Phân loại khám.
// Read-only, data thật từ appointment (server fetch ở home/page.tsx). Tông hồng nhẹ.
// (queue_number/giờ/bác sĩ ở DB phần lớn trống → hiện "—"/"Chưa có giờ", KHÔNG bịa.)

import { fmtTimeOrNone } from "../../../lib/datetime";
import { dayLabel, fmtDayMonth } from "../../../lib/roster";
import { TBL_WRAP, TBL_HEAD, TBL_DIV, TBL_RESIZE, TBL_RESIZE_HINT } from "../form-ui";

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

function doctorKey(a: WeekApptRow): string {
  return a.doctor?.full_name?.trim() || NO_DOCTOR;
}

function PhanLoai({ value }: { value: string }) {
  if (!value) return <span className="text-[#c9a3b8]">—</span>;
  const first = value === "Khám lần đầu";
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " +
        (first
          ? "bg-[#dcfce7] text-[#15803d]"
          : "bg-[#fef3c7] text-[#b45309]")
      }
    >
      {value}
    </span>
  );
}

export default function WeeklyAppointmentsTable({ days }: { days: ApptDay[] }) {
  return (
    <>
    <div className={`${TBL_RESIZE} h-[480px] space-y-3 rounded-xl border border-[#f3cfe0] bg-[#fdf2f8] p-2`}>
      {days.map((day) => {
        // Gom theo bác sĩ (giữ thứ tự xuất hiện; cụm "chưa phân" để cuối).
        const groups = new Map<string, WeekApptRow[]>();
        for (const a of day.items) {
          const k = doctorKey(a);
          const list = groups.get(k);
          if (list) list.push(a);
          else groups.set(k, [a]);
        }
        const ordered = [...groups.entries()].sort((x, y) =>
          x[0] === NO_DOCTOR ? 1 : y[0] === NO_DOCTOR ? -1 : 0,
        );

        return (
          <div key={day.date} className={TBL_WRAP}>
            <div className="flex items-center gap-2 border-b border-[#f3cfe0] bg-[#fce7f3] px-3 py-2">
              <span className="text-sm font-semibold text-[#9d2463]">
                {dayLabel(day.date)} · {fmtDayMonth(day.date)}
              </span>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-[#9d2463]">
                {day.items.length} lịch
              </span>
            </div>

            {day.items.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[#c084a8]">Không có lịch</p>
            ) : (
              ordered.map(([doc, items]) => (
                <div key={doc} className="border-b border-[#f6e0ec] last:border-b-0">
                  <div className="flex items-center gap-2 bg-[#fdf5f9] px-3 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#b83280]">
                      {doc === NO_DOCTOR ? NO_DOCTOR : `BS. ${cleanDoctor(doc)}`}
                    </span>
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#c084a8]">
                      {items.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className={TBL_HEAD}>
                          <th className="px-3 py-1.5 text-left">Khung giờ</th>
                          <th className="px-3 py-1.5 text-left">Số khám</th>
                          <th className="px-3 py-1.5 text-left">Thông tin BN</th>
                          <th className="px-3 py-1.5 text-left">Phân loại khám</th>
                        </tr>
                      </thead>
                      <tbody className={TBL_DIV}>
                        {items.map((a) => (
                          <tr key={a.id} className="transition-colors hover:bg-[#fdf2f8]">
                            <td className="whitespace-nowrap px-3 py-1.5 text-[#171717]">
                              {fmtTimeOrNone(a.slot_start)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-[#52525b]">
                              {a.queue_number ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-[#171717]">
                              <span className="block">{a.patient?.full_name ?? "—"}</span>
                              <span className="block font-mono text-[11px] text-[#888888]">
                                {a.patient?.patient_code}
                                {a.patient?.phone_primary
                                  ? ` · ${a.patient.phone_primary}`
                                  : ""}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <PhanLoai value={a.phan_loai} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
    <p className="mt-1 text-[11px] text-[#c084a8]">{TBL_RESIZE_HINT}</p>
    </>
  );
}
