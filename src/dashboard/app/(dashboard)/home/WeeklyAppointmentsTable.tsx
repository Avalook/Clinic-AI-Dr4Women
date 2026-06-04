// Bảng "Lịch hẹn khám (check đặt lịch)" — bố cục MA TRẬN NGÀY-NGANG Y HỆT file
// Excel "Check đặt lịch": NGÀY trải NGANG ở hàng tiêu đề trên cùng; trong mỗi
// ngày các BÁC SĨ xếp CẠNH NHAU; mỗi bác sĩ có 4 cột con KHUNG GIỜ · SỐ KHÁM ·
// THÔNG TIN · PHÂN LOẠI KHÁM. Lưới dùng CHUNG số dòng (như spreadsheet) — cột
// bác sĩ ít lịch hơn để TRỐNG (ô xám). Toàn bảng cuộn NGANG + DỌC.
// Read-only, data thật từ appointment (giờ/số phần lớn trống → "Chưa có
// giờ"/"—", KHÔNG bịa).

import { Fragment } from "react";
import { fmtTimeOrNone } from "../../../lib/datetime";
import { dayLabel, fmtDayMonth } from "../../../lib/roster";
import { TBL_RESIZE, TBL_RESIZE_HINT } from "../form-ui";

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
        (first ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef3c7] text-[#b45309]")
      }
    >
      {value}
    </span>
  );
}

// 1 cột bác sĩ trong 1 ngày: tên hiển thị + danh sách lịch (đã sắp xếp).
interface DocCol {
  doctor: string;
  appts: WeekApptRow[];
}
// 1 ngày: danh sách cột bác sĩ (rỗng → mảng [] → hiện 1 cột "Không có lịch").
interface DayCol {
  date: string;
  docs: DocCol[];
}

// Viền trái ĐẬM mỗi khi sang NGÀY mới (ngăn các khối ngày như file Excel).
const DAY_EDGE = "border-l-[3px] border-l-[#f3a8cc]";
// Ô thân chung (viền lưới + padding gọn).
const CELL = "border-b border-r border-[#f3cfe0] px-2 py-1.5 align-top";
// Ô để trống của bác sĩ ít lịch hơn (xám nhạt như vùng trống file Excel).
const EMPTY_CELL = "border-b border-r border-[#f3cfe0] bg-[#f6f6f7]";

// Placeholder doctor cho ngày KHÔNG có lịch — để mọi ngày luôn có ≥ 1 cột bác sĩ
// (= 4 sub-col Khung giờ · Số · Thông tin · Phân loại). Giữ lưới đồng đều, tránh
// lệch như trước (ngày trống chỉ 1 cột hẹp, ngày có lịch N×4 cột rộng).
const EMPTY_DOCTOR = "__EMPTY__";

export default function WeeklyAppointmentsTable({ days }: { days: ApptDay[] }) {
  // Dựng cấu trúc ngày → bác sĩ → lịch (giữ thứ tự xuất hiện; "chưa phân" cuối).
  const dayCols: DayCol[] = days.map((day) => {
    const groups = new Map<string, WeekApptRow[]>();
    for (const a of day.items) {
      const k = doctorKey(a);
      const list = groups.get(k);
      if (list) list.push(a);
      else groups.set(k, [a]);
    }
    let docs = [...groups.entries()]
      .sort((x, y) => (x[0] === NO_DOCTOR ? 1 : y[0] === NO_DOCTOR ? -1 : 0))
      .map(([doctor, appts]) => ({ doctor, appts }));
    // Ngày trống: tạo 1 cột bác sĩ "ẩn" để giữ đúng 4 sub-col như các ngày khác.
    if (docs.length === 0) docs = [{ doctor: EMPTY_DOCTOR, appts: [] }];
    return { date: day.date, docs };
  });

  // Số dòng thân = max số lịch của 1 cột bác sĩ bất kỳ trong tuần (lưới chung
  // như spreadsheet). Cột ngắn hơn để trống — giống file Excel.
  const maxRows = Math.max(
    0,
    ...dayCols.flatMap((d) => d.docs.map((c) => c.appts.length)),
  );
  // Tổng số cột = mỗi ngày luôn ≥ 1 cột bác sĩ × 4 sub-col (đã chuẩn hoá ở trên).
  const totalCols = dayCols.reduce((n, d) => n + d.docs.length * 4, 0);

  return (
    <>
      <div
        className={`${TBL_RESIZE} h-[480px] rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)]`}
      >
        <table className="min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            {/* Hàng 1: NGÀY trải ngang (gộp = số bác sĩ × 4 cột con; ngày trống
                vẫn 4 cột nhờ EMPTY_DOCTOR — lưới đồng đều). */}
            <tr className="bg-[#fce7f3]">
              {dayCols.map((d) => (
                <th
                  key={d.date}
                  colSpan={d.docs.length * 4}
                  className={`border-b border-r border-[#f3cfe0] ${DAY_EDGE} px-2 py-2 text-center text-sm font-semibold text-[#9d2463]`}
                >
                  {dayLabel(d.date)} · {fmtDayMonth(d.date)}
                </th>
              ))}
            </tr>
            {/* Hàng 2: BÁC SĨ (gộp 4 cột con) + badge số lịch. EMPTY_DOCTOR
                render dấu — (không badge số) để giữ đúng cấu trúc lưới. */}
            <tr className="bg-[#fdf5f9]">
              {dayCols.map((d) =>
                d.docs.map((c, ci) => {
                  const empty = c.doctor === EMPTY_DOCTOR;
                  return (
                    <th
                      key={d.date + c.doctor + ci}
                      colSpan={4}
                      className={`border-b border-r border-[#f3cfe0] ${ci === 0 ? DAY_EDGE : ""} px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide ${empty ? "text-[#c084a8]" : "text-[#b83280]"}`}
                    >
                      {empty
                        ? "—"
                        : c.doctor === NO_DOCTOR
                          ? NO_DOCTOR
                          : `BS. ${cleanDoctor(c.doctor)}`}
                      {!empty && (
                        <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#c084a8]">
                          {c.appts.length}
                        </span>
                      )}
                    </th>
                  );
                }),
              )}
            </tr>
            {/* Hàng 3: 4 cột con KHUNG GIỜ · SỐ KHÁM · THÔNG TIN · PHÂN LOẠI KHÁM
                (cho MỌI ngày — kể cả ngày trống). */}
            <tr className="bg-[#fce7f3] text-[10px] font-semibold uppercase tracking-wide text-[#9d2463]">
              {dayCols.map((d) =>
                d.docs.map((c, ci) => (
                  <Fragment key={d.date + c.doctor + ci}>
                    <th
                      className={`border-b border-r border-[#f3cfe0] ${ci === 0 ? DAY_EDGE : ""} min-w-[58px] px-2 py-1 text-left`}
                    >
                      Khung giờ
                    </th>
                    <th className="min-w-[44px] border-b border-r border-[#f3cfe0] px-2 py-1 text-left">
                      Số
                    </th>
                    <th className="min-w-[168px] border-b border-r border-[#f3cfe0] px-2 py-1 text-left">
                      Thông tin
                    </th>
                    <th className="min-w-[96px] border-b border-r border-[#f3cfe0] px-2 py-1 text-left">
                      Phân loại khám
                    </th>
                  </Fragment>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {maxRows === 0 ? (
              <tr>
                <td
                  colSpan={totalCols || 1}
                  className="px-3 py-6 text-center text-xs text-[#c084a8]"
                >
                  Chưa có lịch hẹn nào trong tuần
                </td>
              </tr>
            ) : (
              Array.from({ length: maxRows }).map((_, i) => (
                <tr key={i} className={i % 2 ? "bg-[#fdf7fb]" : "bg-white"}>
                  {dayCols.map((d) =>
                    d.docs.map((c, ci) => {
                      const empty = c.doctor === EMPTY_DOCTOR;
                      const edge = ci === 0 ? DAY_EDGE : "";
                      // Ngày KHÔNG có lịch — chỉ in "Không có lịch" 1 lần ở dòng
                      // đầu, dòng sau để trống (giữ cùng 4 cột → lưới đồng đều).
                      if (empty) {
                        return (
                          <td
                            key={`${d.date}-empty-${i}`}
                            colSpan={4}
                            className={`${EMPTY_CELL} ${edge} text-center text-[11px] text-[#c9c9cf]`}
                          >
                            {i === 0 ? "Không có lịch" : ""}
                          </td>
                        );
                      }
                      const a = c.appts[i];
                      if (!a) {
                        return (
                          <td
                            key={`${d.date}-${c.doctor}-${i}`}
                            colSpan={4}
                            className={`${EMPTY_CELL} ${edge}`}
                          />
                        );
                      }
                      return (
                        <Fragment key={a.id}>
                          <td
                            className={`${CELL} ${edge} whitespace-nowrap text-[#171717]`}
                          >
                            {fmtTimeOrNone(a.slot_start)}
                          </td>
                          <td
                            className={`${CELL} whitespace-nowrap text-center text-[#52525b]`}
                          >
                            {a.queue_number ?? "—"}
                          </td>
                          <td className={`${CELL} text-[#171717]`}>
                            <span className="block">
                              {a.patient?.full_name ?? "—"}
                            </span>
                            <span className="block font-mono text-[10px] text-[#888888]">
                              {a.patient?.patient_code}
                              {a.patient?.phone_primary
                                ? ` · ${a.patient.phone_primary}`
                                : ""}
                            </span>
                          </td>
                          <td className={CELL}>
                            <PhanLoai value={a.phan_loai} />
                          </td>
                        </Fragment>
                      );
                    }),
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-[#c084a8]">{TBL_RESIZE_HINT}</p>
    </>
  );
}
