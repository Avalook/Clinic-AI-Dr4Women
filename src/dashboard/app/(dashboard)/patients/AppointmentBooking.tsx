"use client";

// Reusable appointment-booking form for ONE patient. Used both in the
// new-patient intake flow (step 2 of NewPatientForm) and standalone on a
// patient's profile (PatientBooking). It renders ONLY the form; the parent
// owns the success UI and decides what happens after a booking via onBooked.
// Write path = POST /api/appointments (service-role + intake-role guard).

import { useState, useMemo, type ReactNode } from "react";
import { vnLocalToUtcISO, nowMs } from "../../../lib/datetime";
import { todayVn, clinicHoursForDate, clinicHoursError } from "../../../lib/roster";
import { INPUT, LABEL, BTN, DURATIONS, CHANNELS } from "../form-ui";
import { unaccentVi } from "../../../lib/validation";
import Time24Input from "../Time24Input";
import DateField from "../DateField";

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
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [duration, setDuration] = useState(30);
  // Kênh đặt = nhập tự do (sau tự tính từ Pancake). Để trống được.
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
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={INPUT}
          >
            <option value="">— Chọn dịch vụ —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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
          />
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
            placeholder="VD: 5 / ƯT1 (tuỳ chọn)"
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Thời lượng</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={INPUT}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} phút
              </option>
            ))}
          </select>
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
            {CHANNELS.map((c) => (
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
