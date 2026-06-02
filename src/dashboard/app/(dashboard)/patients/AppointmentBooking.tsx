"use client";

// Reusable appointment-booking form for ONE patient. Used both in the
// new-patient intake flow (step 2 of NewPatientForm) and standalone on a
// patient's profile (PatientBooking). It renders ONLY the form; the parent
// owns the success UI and decides what happens after a booking via onBooked.
// Write path = POST /api/appointments (service-role + intake-role guard).

import { useState, type ReactNode } from "react";
import { vnLocalToUtcISO } from "../../../lib/datetime";

export interface Option {
  id: string;
  label: string;
}

// text-base on mobile (16px) prevents iOS auto-zoom on focus; min-h gives a
// comfortable tap target. Shrinks to the denser desktop sizing at ≥sm.
const INPUT =
  "w-full min-h-11 rounded-md border border-[#e4e4e7] px-3 py-2.5 text-base text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20 sm:min-h-0 sm:py-2 sm:text-sm";
const LABEL = "text-sm font-medium text-[#4d4d4d]";
const BTN =
  "min-h-11 w-full rounded-md bg-[#ec4899] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2";

const CHANNELS = [
  { id: "WALK_IN", label: "Khách tới trực tiếp" },
  { id: "HOTLINE", label: "Hotline" },
  { id: "ZALO_PK", label: "Zalo" },
  { id: "FB_DR4WOMEN", label: "Facebook" },
  { id: "REFERRAL", label: "Giới thiệu" },
];
const DURATIONS = [15, 30, 45, 60];

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
  const [doctorId, setDoctorId] = useState("");
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? locations[0]?.id ?? "",
  );
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [channel, setChannel] = useState("WALK_IN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canBook = serviceId && locationId && apptDate && apptTime;

  async function book() {
    setError(null);
    setSubmitting(true);
    // Interpret the picked date+time as Vietnam time (GMT+7), not the browser's.
    const start = new Date(vnLocalToUtcISO(apptDate, apptTime));
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
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className={INPUT}
          >
            <option value="">— Chưa phân bác sĩ —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Ngày *</label>
          <input
            type="date"
            value={apptDate}
            onChange={(e) => setApptDate(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Giờ *</label>
          <input
            type="time"
            value={apptTime}
            onChange={(e) => setApptTime(e.target.value)}
            className={INPUT}
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
