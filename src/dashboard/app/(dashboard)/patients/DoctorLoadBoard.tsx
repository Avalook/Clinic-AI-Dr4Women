"use client";

// Bảng CHỈ-ĐỌC "Tải hôm nay theo bác sĩ" cho LỄ TÂN ở màn Tạo bệnh nhân (walk-in).
// Mục đích: lễ tân NHÌN tải từng bác sĩ hôm nay để ĐỊNH TUYẾN ca walk-in tránh
// nghẽn (vd BS Thành đông → đẩy sang bác sĩ phụ). KHÔNG chọn slot, KHÔNG check-in
// — đó là việc của CSKH (đặt lịch) và bảng "Lịch hẹn khám" ở /home (check-in).
// Số khám vẫn do hệ thống cấp tự động = số chung theo thời gian (không đụng ở đây).

import type { Option } from "./AppointmentBooking";

interface LoadAppt {
  slot_start: string;
  doctor_id: string | null;
  queue_number: string | null;
  status: string;
}

// Đã đến / đang khám (ghế xanh); COMPLETED = đã xong (xám); còn lại = chưa đến.
const ARRIVED = new Set(["CHECKED_IN", "IN_PROGRESS"]);

const STATUS_VN: Record<string, string> = {
  SCHEDULED: "Chưa đến",
  CSKH_CONFIRMED: "Chưa đến",
  CONFIRMED: "Chưa đến",
  CHECKED_IN: "Đã đến",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã khám xong",
};

const NO_DOCTOR = "Chưa phân bác sĩ";

function vnHHmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function DoctorLoadBoard({
  appts,
  doctors,
  selectedDoctorId,
}: {
  appts: LoadAppt[];
  doctors: Option[];
  selectedDoctorId: string;
}) {
  const labelOf = (id: string | null): string =>
    (id && doctors.find((d) => d.id === id)?.label) || NO_DOCTOR;

  // Hàng = các bác sĩ có lịch hôm nay, LUÔN gồm bác sĩ đang chọn (để thấy "0 ca").
  const idSet = new Set<string>();
  for (const a of appts) idSet.add(a.doctor_id ?? "");
  if (selectedDoctorId) idSet.add(selectedDoctorId);
  const doctorIds = [...idSet].filter((id) => id !== "" || appts.some((a) => !a.doctor_id));

  // Cột = các khung giờ có lịch, sắp tăng dần.
  const timeSet = new Set<string>();
  for (const a of appts) timeSet.add(vnHHmm(a.slot_start));
  const times = [...timeSet].sort();

  // (doctor_id|giờ) → ghế.
  const cellMap = new Map<string, LoadAppt[]>();
  for (const a of appts) {
    const key = `${a.doctor_id ?? ""}|${vnHHmm(a.slot_start)}`;
    const arr = cellMap.get(key) ?? [];
    arr.push(a);
    cellMap.set(key, arr);
  }

  // Sắp hàng: bác sĩ đang chọn lên đầu, "Chưa phân" xuống cuối, còn lại theo tên.
  doctorIds.sort((a, b) => {
    if (a === selectedDoctorId) return -1;
    if (b === selectedDoctorId) return 1;
    if (a === "") return 1;
    if (b === "") return -1;
    return labelOf(a).localeCompare(labelOf(b), "vi");
  });

  const countFor = (id: string) => appts.filter((a) => (a.doctor_id ?? "") === id).length;
  const arrivedFor = (id: string) =>
    appts.filter((a) => (a.doctor_id ?? "") === id && ARRIVED.has(a.status)).length;

  if (doctorIds.length === 0 || times.length === 0) {
    return (
      <p className="rounded-lg border border-[#e4e4e7] bg-gray-50 px-3 py-2 text-xs text-[#71717a]">
        Hôm nay chưa có lịch hẹn nào — chọn bác sĩ ở trên để cấp khám.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717a]">
        <span className="font-medium text-[#171717]">Tải hôm nay theo bác sĩ</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-[#f3cfe0] bg-white" /> Chưa đến
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#15803d]" /> Đã đến
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#e5e7eb]" /> Đã xong
        </span>
        <span className="text-[#a1a1aa]">— nhìn để chọn bác sĩ đỡ nghẽn cho khách</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#f3cfe0]">
        <table className="border-separate border-spacing-1 p-2">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 text-left text-[11px] font-medium text-[#71717a]">
                Bác sĩ \ Giờ
              </th>
              {times.map((t) => (
                <th key={t} className="px-0.5 text-[10px] font-normal text-[#a1a1aa]">
                  {t}
                </th>
              ))}
              <th className="px-1 text-[10px] font-normal text-[#a1a1aa]">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {doctorIds.map((id) => {
              const isSel = id === selectedDoctorId;
              return (
                <tr key={id || NO_DOCTOR} className={isSel ? "bg-[#fdf2f8]" : undefined}>
                  <td
                    className={
                      "sticky left-0 z-10 whitespace-nowrap px-2 text-xs " +
                      (isSel
                        ? "bg-[#fdf2f8] font-semibold text-[#9d2463]"
                        : "bg-white font-medium text-[#171717]")
                    }
                  >
                    {labelOf(id)}
                  </td>
                  {times.map((t) => {
                    const cell = cellMap.get(`${id}|${t}`) ?? [];
                    return (
                      <td key={t} className="p-0 align-top">
                        {cell.length === 0 ? (
                          <div className="h-7 w-9" />
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {cell.map((a, i) => {
                              const arrived = ARRIVED.has(a.status);
                              const done = a.status === "COMPLETED";
                              const label = a.queue_number?.trim() || (arrived ? "✓" : "•");
                              return (
                                <span
                                  key={`${t}-${i}`}
                                  title={`${t} · ${STATUS_VN[a.status] ?? a.status}${a.queue_number ? ` · số ${a.queue_number}` : ""}`}
                                  className={
                                    "flex h-7 min-w-9 items-center justify-center rounded px-1 text-[10px] font-semibold " +
                                    (arrived
                                      ? "bg-[#15803d] text-white"
                                      : done
                                        ? "bg-[#e5e7eb] text-[#a1a1aa]"
                                        : "border border-[#f3cfe0] bg-white text-[#9d2463]")
                                  }
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={
                      "px-1 text-center text-[11px] " +
                      (isSel ? "font-semibold text-[#9d2463]" : "text-[#71717a]")
                    }
                  >
                    {countFor(id)}
                    {arrivedFor(id) > 0 && (
                      <span className="text-[#15803d]"> ({arrivedFor(id)}↩)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
