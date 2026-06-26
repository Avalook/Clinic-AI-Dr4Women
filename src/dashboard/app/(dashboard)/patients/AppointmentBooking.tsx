"use client";

// Reusable appointment-booking form for ONE patient. Used both in the
// new-patient intake flow (step 2 of NewPatientForm) and standalone on a
// patient's profile (PatientBooking). It renders ONLY the form; the parent
// owns the success UI and decides what happens after a booking via onBooked.
// Write path = POST /api/appointments (service-role + intake-role guard).

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { vnLocalToUtcISO, nowMs } from "../../../lib/datetime";
import { todayVn, clinicHoursForDate, clinicHoursError } from "../../../lib/roster";
import { INPUT, LABEL, BTN, DURATIONS, CHANNELS } from "../form-ui";
import { unaccentVi } from "../../../lib/validation";
import Time24Input from "../Time24Input";
import DateField from "../DateField";
import { LINH_VUC_OPTIONS } from "../../../lib/linh-vuc";
import CinemaSlotPicker from "./CinemaSlotPicker";

function findServiceIdByLinhVuc(code: string, services: Option[]): string {
  if (!code) return "";
  const nameMap: Record<string, string[]> = {
    PK: ["Phụ khoa", "PHU_KHOA"],
    SK: ["Sản 1", "Sản khoa", "Sản", "SAN_1"],
    NT: ["Nội tiết - Tình dục", "Nội tiết", "NOI_TIET_TINH_DUC"],
    HMVS: ["Hiếm muộn", "Hiếm muộn - Vô sinh", "HIEM_MUON"],
    NK: ["Nam khoa", "NAM_KHOA"],
  };
  const targets = nameMap[code] ?? [];
  for (const t of targets) {
    const found = services.find((s) => s.label.toLowerCase() === t.toLowerCase());
    if (found) return found.id;
  }
  for (const t of targets) {
    const found = services.find((s) => s.label.toLowerCase().includes(t.toLowerCase()));
    if (found) return found.id;
  }
  return services[0]?.id ?? "";
}

export interface Option {
  id: string;
  label: string;
}

export default function AppointmentBooking({
  clinicPatientId,
  services,
  doctors,
  locations,
  defaultLocationId,
  onBooked,
  secondary,
}: {
  clinicPatientId: string;
  services: Option[];
  doctors: Option[];
  locations: Option[];
  /** Pre-select a location (e.g. the one chosen at intake). */
  defaultLocationId?: string;
  /** Called with the new appointment id once the booking succeeds. */
  onBooked: (appointmentId: string) => void;
  /** Optional extra control rendered next to the submit button (e.g. "skip"). */
  secondary?: ReactNode;
}) {
  const [serviceId, setServiceId] = useState("");
  // Bác sĩ: combobox tìm kiếm bỏ dấu thay native <select>
  const [doctorId, setDoctorId] = useState("");
  const [doctorQ, setDoctorQ] = useState(""); // text hiện trong ô
  const [doctorOpen, setDoctorOpen] = useState(false);
  const filteredDoctors = useMemo(() => {
    const t = unaccentVi(doctorQ.trim());
    if (!t) return doctors;
    return doctors.filter((d) => unaccentVi(d.label).includes(t));
  }, [doctorQ, doctors]);
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? locations[0]?.id ?? "",
  );
  const [linhVuc, setLinhVuc] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [duration, setDuration] = useState(15);
  const [existingAppts, setExistingAppts] = useState<any[]>([]);

  // Fetch appointments for selected date to check availability
  useEffect(() => {
    if (!apptDate) {
      setExistingAppts([]);
      return;
    }
    let active = true;
    // Lấy lịch của MỌI bác sĩ trong ngày (KHÔNG lọc doctor_id) để sơ đồ "rạp
    // chiếu phim" vẽ được từng hàng bác sĩ. isSlotBooked vẫn lọc theo doctorId
    // ở phía client nhờ field appt.doctor_id còn nguyên trong kết quả.
    fetch(`/api/appointments?date=${encodeURIComponent(apptDate)}`)
      .then((r) => (r.ok ? r.json() : { appointments: [] }))
      .then((data) => {
        if (active) {
          setExistingAppts(data.appointments ?? []);
        }
      })
      .catch(() => {
        if (active) setExistingAppts([]);
      });
    return () => {
      active = false;
    };
  }, [apptDate]);

  // CSKH: Tính toán số chỗ trống
  const isSlotBooked = useMemo(() => {
    if (!apptDate || !apptTime) return false;
    try {
      const targetUtcStr = vnLocalToUtcISO(apptDate, apptTime);
      return existingAppts.some((appt) => {
        const matchDoc = !doctorId || appt.doctor_id === doctorId;
        return matchDoc && appt.slot_start === targetUtcStr;
      });
    } catch {
      return false;
    }
  }, [apptDate, apptTime, doctorId, existingAppts]);

  // CSKH: số khám ĐỂ TRỐNG — hệ thống cấp SỐ CHUNG THEO THỜI GIAN lúc check-in.
  // KHÔNG tự dập "ƯT" theo phút (sai nghĩa): ƯT chỉ dành cho NGƯỜI QUEN nhà bác sĩ,
  // do người nhập gõ tay khi cần. Đổi ngày/giờ → xoá số đang điền cho gọn.
  useEffect(() => {
    setQueueNumber("");
  }, [apptTime, isSlotBooked]);

  const [channel, setChannel] = useState("");
  const [queueNumber, setQueueNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canBook = serviceId && locationId && apptDate && apptTime;
  // Giới hạn giờ theo ngày đã chọn (giờ mở cửa PK).
  const ch = apptDate ? clinicHoursForDate(apptDate) : null;
  const minHour = ch ? Number(ch.open.slice(0, 2)) : 0;
  const maxHour = ch ? Number(ch.close.slice(0, 2)) - 1 : 23;

  async function book() {
    setError(null);
    // Interpret the picked date+time as Vietnam time (GMT+7), not the browser's.
    const start = new Date(vnLocalToUtcISO(apptDate, apptTime));
    // Logic thời gian thực: KHÔNG cho đặt lịch vào quá khứ.
    if (start.getTime() < nowMs()) {
      setError("Không thể đặt lịch trong quá khứ. Chọn ngày/giờ từ hiện tại trở đi.");
      return;
    }
    // Trong giờ mở cửa PK (T2–T6 17–23h; T7+CN cả ngày).
    const chErr = clinicHoursError(apptDate, apptTime);
    if (chErr) {
      setError(chErr);
      return;
    }
    setSubmitting(true);
    const end = new Date(start.getTime() + duration * 60_000);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_patient_id: clinicPatientId,
        doctor_id: doctorId,
        service_type_id: serviceId,
        location_id: locationId,
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        booking_channel: channel,
        queue_number: queueNumber,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "Có lỗi xảy ra.");
      return;
    }
    onBooked(json.appointment_id as string);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={LABEL}>Dịch vụ *</label>
          <select
            value={linhVuc}
            onChange={(e) => {
              const code = e.target.value;
              setLinhVuc(code);
              const svcId = findServiceIdByLinhVuc(code, services);
              setServiceId(svcId);
            }}
            className={INPUT}
          >
            <option value="">— Chọn dịch vụ —</option>
            {LINH_VUC_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Bác sĩ</label>
          {/* Combobox: gõ tìm — không phân biệt dấu / hoa-thường */}
          <div className="relative">
            <input
              value={doctorQ}
              onChange={(e) => {
                setDoctorQ(e.target.value);
                setDoctorId(""); // xóa chọn cũ khi gõ đè
                setDoctorOpen(true);
              }}
              onFocus={() => setDoctorOpen(true)}
              onBlur={() => setTimeout(() => setDoctorOpen(false), 150)}
              placeholder="Tìm bác sĩ… (bỏ trống nếu chưa phân)"
              className={INPUT}
              autoComplete="off"
            />
            {doctorOpen && (
              <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-[#e4e4e7] bg-white shadow-lg">
                <li
                  onMouseDown={() => {
                    setDoctorId("");
                    setDoctorQ("");
                    setDoctorOpen(false);
                  }}
                  className="cursor-pointer px-3 py-2 text-sm text-[#71717a] hover:bg-[#fdf2f8]"
                >
                  — Chưa phân bác sĩ —
                </li>
                {filteredDoctors.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[#a1a1aa]">
                    Không tìm thấy bác sĩ
                  </li>
                ) : (
                  filteredDoctors.map((d) => (
                    <li
                      key={d.id}
                      onMouseDown={() => {
                        setDoctorId(d.id);
                        setDoctorQ(d.label);
                        setDoctorOpen(false);
                      }}
                      className={
                        "cursor-pointer px-3 py-2 text-sm hover:bg-[#fdf2f8] " +
                        (d.id === doctorId
                          ? "bg-[#fce7f3] font-medium text-[#9d2463]"
                          : "text-[#171717]")
                      }
                    >
                      {d.label}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Ngày *</label>
          <DateField
            value={apptDate}
            onChange={setApptDate}
            min={todayVn()}
            ariaLabel="Ngày khám"
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Giờ *</label>
          <Time24Input
            value={apptTime}
            onChange={setApptTime}
            minHour={minHour}
            maxHour={maxHour}
            minutesOptions={["00", "15", "30", "45"]}
          />
          <p className="mt-1 text-[11px] text-[#dc2626] font-medium leading-normal">
            ⚠️ Lưu ý: Quý khách vui lòng đến đúng giờ hoặc muộn nhất 15 phút để giữ chỗ. Nếu đến muộn, lịch hẹn sẽ không còn hiệu lực ưu tiên (sẽ xếp số vãng lai theo thứ tự đến trực tiếp).
          </p>
          {ch && (
            <p className="mt-1 text-[11px] text-[#a1a1aa]">
              Giờ mở cửa: {ch.open}–{ch.close}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Số khám</label>
          <input
            value={queueNumber}
            onChange={(e) => setQueueNumber(e.target.value)}
            className={INPUT}
            placeholder="Để trống — gõ ƯT cho người quen nhà bác sĩ"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className={LABEL}>Chọn chỗ (sơ đồ trống)</label>
          <CinemaSlotPicker
            date={apptDate}
            doctors={doctors}
            existingAppts={existingAppts}
            selectedDoctorId={doctorId}
            selectedTime={apptTime}
            onPick={(docId, t) => {
              setApptTime(t);
              setDoctorId(docId);
              setDoctorQ(docId ? (doctors.find((d) => d.id === docId)?.label ?? "") : "");
            }}
          />
          {apptDate && apptTime && (
            <p
              className={`text-[11px] font-medium ${
                isSlotBooked ? "text-[#dc2626]" : "text-[#15803d]"
              }`}
            >
              {isSlotBooked
                ? "Khung đang chọn đã kín — chọn ô khác."
                : "Khung đang chọn còn trống."}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Cơ sở *</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={INPUT}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Kênh đặt</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className={INPUT}
          >
            <option value="">— Chọn kênh —</option>
            {CHANNELS.filter((c) => c.id !== "WALK_IN").map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={book} disabled={!canBook || submitting} className={BTN}>
          {submitting ? "Đang đặt..." : "Đặt lịch hẹn"}
        </button>
        {secondary}
      </div>
    </div>
  );
}
