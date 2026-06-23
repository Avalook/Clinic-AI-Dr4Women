"use client";

// Bảng "Lịch hẹn khám (check đặt lịch)" — TÁI CẤU TRÚC theo yêu cầu: THỜI GIAN
// nằm ở CÁC HÀNG (mỗi dòng = 1 lịch hẹn, sắp theo giờ), còn KHUNG GIỜ · SỐ · BÁC
// SĨ · THÔNG TIN · PHÂN LOẠI KHÁM là CÁC CỘT. Gom theo ngày: mỗi ngày 1 dòng tiêu
// đề, dưới là các lịch của ngày đó. Read-only, data thật từ appointment (giờ/số
// phần lớn trống → "Chưa có giờ"/"—", KHÔNG bịa). Khung kéo co dãn + cuộn.

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Printer, X } from "lucide-react";
import { canCheckin, type ClinicRole } from "../../../lib/roles";
import ClinicalRecordForm from "../tasks/ClinicalRecordForm";
import { fmtTimeOrNone } from "../../../lib/datetime";
import { dayLabel, fmtDayMonth } from "../../../lib/roster";
import { compareQueue } from "../../../lib/queue";
import { doctorName } from "../../../lib/doctor-name";

export interface WeekApptRow {
  id: string;
  slot_start: string;
  status: string;
  queue_number: string | null;
  phan_loai: string; // "Tái khám" | "Khám lần đầu" | "" (suy từ lịch sử hẹn)
  patient: {
    clinic_patient_id: string;
    full_name: string;
    patient_code: string;
    phone_primary: string | null;
    date_of_birth: string | null;
    phone_secondary: string | null;
    gender: string | null;
    ethnicity: string | null;
    nationality: string | null;
    occupation: string | null;
    patient_objection: string | null;
    address: string | null;
    guardian_name: string | null;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}
export interface ApptDay {
  date: string;
  items: WeekApptRow[];
}

const NO_DOCTOR = "Chưa phân bác sĩ";

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

const STATUS_VN: Record<string, string> = {
  SCHEDULED: "Chưa xác nhận",
  CSKH_CONFIRMED: "Đã xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  COMPLETED: "Đã khám xong",
  NO_SHOW: "Không đến",
  CANCELLED: "Đã huỷ",
  DOCTOR_DECLINED: "Bác sĩ từ chối",
};

export default function WeeklyAppointmentsTable({
  days,
  role,
  staffId,
  canWriteClinical = false,
}: {
  days: ApptDay[];
  role: ClinicRole | null;
  staffId: string | null;
  canWriteClinical?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selAppt, setSelAppt] = useState<WeekApptRow | null>(null);

  const showActions = canCheckin(role);

  async function act(
    id: string,
    action: "checkin" | "undo_checkin" | "no_show",
  ) {
    if (busyId) return;
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

  // Cả tuần KHÔNG có lịch → thẻ rỗng GỌN (không dựng bảng trống huơ).
  if (days.every((d) => d.items.length === 0)) {
    return (
      <div className="rounded-xl border border-dashed border-[#f3cfe0] bg-white px-4 py-10 text-center text-sm text-[#c084a8] shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
        Chưa có lịch hẹn nào trong tuần này.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-[#fee2e2] px-3 py-2 text-xs text-[#dc2626]">
          {error}
        </div>
      )}
      <div className="resize overflow-auto rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)] max-h-[88vh] min-h-[180px] max-w-full">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#fce7f3]">
              <th className={`${TH} min-w-[78px]`}>Khung giờ</th>
              <th className={`${TH} min-w-[52px]`}>Số</th>
              <th className={`${TH} min-w-[120px]`}>Bác sĩ</th>
              <th className={`${TH} min-w-[200px]`}>Thông tin</th>
              <th className={`${TH} min-w-[110px]`}>Phân loại khám</th>
              {showActions && <th className={`${TH} min-w-[150px]`}>Thao tác Check-in</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              // Thứ tự khám: ƯT lên đầu → số → theo giờ (compareQueue).
              const items = [...day.items].sort(compareQueue);
              return (
                <Fragment key={day.date}>
                  {/* Dòng tiêu đề NGÀY (gộp cả 5 hoặc 6 cột). */}
                  <tr className="bg-[#fdf2f8]">
                    <td
                      colSpan={showActions ? 6 : 5}
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
                        colSpan={showActions ? 6 : 5}
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
                            ? doctorName(a.doctor.full_name)
                            : NO_DOCTOR}
                        </td>
                        <td className={`${CELL} text-[#171717]`}>
                          {showActions ? (
                            <button
                              onClick={() => setSelAppt(a)}
                              className="block font-medium text-[#ec4899] hover:underline text-left"
                            >
                              {a.patient?.full_name ?? "—"}
                            </button>
                          ) : (
                            <span className="block font-medium">{a.patient?.full_name ?? "—"}</span>
                          )}
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
                        {showActions && (
                          <td className={CELL}>
                            {a.status === "COMPLETED" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#52525b]">
                                  Đã khám xong
                                </span>
                                <a
                                  href={`/print/${a.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-7 items-center gap-1 rounded border border-[#bbf7d0] bg-white px-2 text-[11px] font-semibold text-[#15803d] hover:bg-[#f0fdf4]"
                                >
                                  <Printer size={11} /> In phiếu
                                </a>
                              </div>
                            ) : a.status === "CHECKED_IN" ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
                                  Đang chờ khám
                                </span>
                                <button
                                  onClick={() => act(a.id, "undo_checkin")}
                                  disabled={busyId === a.id}
                                  className="text-[10px] text-[#a1a1aa] hover:text-[#71717a] font-medium disabled:opacity-50"
                                >
                                  Hoàn tác check-in
                                </button>
                              </div>
                            ) : ["SCHEDULED", "CSKH_CONFIRMED", "CONFIRMED"].includes(a.status) ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => act(a.id, "checkin")}
                                  disabled={busyId === a.id}
                                  className="rounded bg-[#ec4899] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#db2777] disabled:opacity-50"
                                >
                                  {busyId === a.id ? "..." : "Check-in"}
                                </button>
                                <button
                                  onClick={() => act(a.id, "no_show")}
                                  disabled={busyId === a.id}
                                  className="text-[10px] text-[#a1a1aa] hover:text-[#dc2626] font-medium disabled:opacity-50"
                                >
                                  Không đến
                                </button>
                              </div>
                            ) : (
                              <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#52525b]">
                                {STATUS_VN[a.status] ?? a.status}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelAppt(null)}>
          <div className="w-full max-w-4xl h-[85vh] rounded-xl border border-[#f3cfe0] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between border-b border-[#f3cfe0] pb-2">
              <h3 className="text-base font-semibold text-[#9d2463]">Hành chính & Sinh hiệu bệnh nhân</h3>
              <button onClick={() => setSelAppt(null)} className="rounded-md p-1 text-[#9d2463] hover:bg-[#fce7f3]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ClinicalRecordForm
                appt={selAppt as any}
                staffId={staffId}
                vitalsOnly
                readOnly={!canWriteClinical}
                fill
                onClose={() => setSelAppt(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
