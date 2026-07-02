"use client";

// Lưới đặt chỗ kiểu "rạp chiếu phim" dùng chung cho CSKH: mỗi bác sĩ 1 hàng,
// mỗi ô = 1 khung 15 phút trong giờ mở cửa PK. Ô đã có lịch → khoá (xám); ô quá
// khứ (hôm nay) → khoá; ô đang chọn → hồng đậm; ô trống → bấm để chọn (set giờ +
// bác sĩ qua onPick). KHÔNG tự fetch/POST — parent truyền data + nhận callback,
// nên dùng chung được cho cả AppointmentBooking (tái khám) và NewPatientForm (BN mới).

import { useMemo } from "react";
import { vnLocalToUtcISO, nowMs } from "../../../lib/datetime";
import { clinicHoursForDate } from "../../../lib/roster";
import type { Option } from "./AppointmentBooking";

interface ApptLite {
  slot_start: string;
  doctor_id: string | null;
}

// Cùng bộ phút với Time24Input của màn đặt lịch (ƯT1–ƯT4).
const MINUTES = ["00", "15", "30", "45"];

export default function CinemaSlotPicker({
  date,
  doctors,
  existingAppts,
  selectedDoctorId,
  selectedTime,
  onPick,
}: {
  date: string;
  doctors: Option[];
  existingAppts: ApptLite[];
  selectedDoctorId: string;
  selectedTime: string;
  onPick: (doctorId: string, hhmm: string) => void;
}) {
  // Các cột giờ (HH:mm) nằm trong giờ mở cửa của NGÀY đã chọn.
  const slots = useMemo(() => {
    if (!date) return [] as string[];
    const ch = clinicHoursForDate(date);
    if (!ch) return [] as string[];
    const minHour = Number(ch.open.slice(0, 2));
    const maxHour = Number(ch.close.slice(0, 2)); // giờ đóng cửa = mốc loại trừ
    const out: string[] = [];
    for (let h = minHour; h < maxHour; h++) {
      for (const m of MINUTES) {
        out.push(`${String(h).padStart(2, "0")}:${m}`);
      }
    }
    return out;
  }, [date]);

  // Tập khung ĐÃ CÓ lịch: key = `${doctor_id}|${epoch ms của slot_start}` (API đã
  // lọc bỏ CANCELLED/NO_SHOW nên còn ở đây nghĩa là chỗ thật sự bận).
  const bookedSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of existingAppts) {
      // Gồm CẢ lịch chưa phân bác sĩ (doctor_id null) → key bác sĩ rỗng "" để
      // hàng "Chưa phân bác sĩ" bên dưới cũng khoá được ô đã đặt.
      // Key giờ = epoch ms (KHÔNG dùng chuỗi ISO thô): PostgREST trả
      // "+00:00" không mili-giây, còn toISOString() ra ".000Z" — so chuỗi sẽ trượt.
      s.add(`${a.doctor_id ?? ""}|${Date.parse(a.slot_start)}`);
    }
    return s;
  }, [existingAppts]);

  if (!date) {
    return (
      <p className="rounded-lg border border-[#e4e4e7] bg-gray-50 px-3 py-2 text-sm text-[#71717a]">
        Chọn ngày khám để hiện sơ đồ chỗ trống.
      </p>
    );
  }
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-[#e4e4e7] bg-gray-50 px-3 py-2 text-sm text-[#71717a]">
        Ngày này phòng khám không có khung giờ mở cửa.
      </p>
    );
  }

  // Không có bác sĩ nào để xếp hàng → vẫn cho chọn giờ ở hàng "Chưa phân bác sĩ".
  // LUÔN có thêm hàng "Chưa phân bác sĩ": lịch đặt online chưa phân BS vẫn hiện
  // "đã kín" — nếu thiếu hàng này, đặt cho khách sau sẽ không thấy lịch khách trước.
  const rows: Option[] = [...doctors, { id: "", label: "Chưa phân bác sĩ" }];
  const now = nowMs();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#71717a]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-[#f3cfe0] bg-white" />{" "}
          Trống
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#9d2463]" /> Đang chọn
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#e5e7eb]" /> Đã kín / quá giờ
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#f3cfe0]">
        <table className="border-separate border-spacing-1 p-2">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 text-left text-[11px] font-medium text-[#71717a]">
                Bác sĩ \ Giờ
              </th>
              {slots.map((t) => (
                <th
                  key={t}
                  className="px-0.5 text-[10px] font-normal text-[#a1a1aa]"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id || "none"}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 text-xs font-medium text-[#171717]">
                  {d.label}
                </td>
                {slots.map((t) => {
                  let iso = "";
                  try {
                    iso = vnLocalToUtcISO(date, t);
                  } catch {
                    iso = "";
                  }
                  const isPast = iso ? new Date(iso).getTime() < now : false;
                  // Kể cả hàng "Chưa phân bác sĩ" (d.id="") cũng đọc bookedSet.
                  const isBooked = iso
                    ? bookedSet.has(`${d.id}|${Date.parse(iso)}`)
                    : false;
                  const isSelected =
                    d.id === selectedDoctorId && t === selectedTime;
                  const disabled = isPast || isBooked;
                  return (
                    <td key={t} className="p-0">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(d.id, t)}
                        title={`${d.label} · ${t}${
                          isBooked ? " · đã kín" : isPast ? " · đã qua" : ""
                        }`}
                        className={
                          "h-7 w-7 rounded text-[10px] font-medium transition " +
                          (isSelected
                            ? "bg-[#9d2463] text-white"
                            : disabled
                              ? "cursor-not-allowed bg-[#e5e7eb] text-[#a1a1aa]"
                              : "border border-[#f3cfe0] bg-white text-[#9d2463] hover:bg-[#fce7f3]")
                        }
                      >
                        {isSelected ? "✓" : isBooked ? "×" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
