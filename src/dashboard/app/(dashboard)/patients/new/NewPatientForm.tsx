"use client";

import { useState } from "react";
import Link from "next/link";

export interface Option {
  id: string;
  label: string;
}

interface CreatedPatient {
  clinic_patient_id: string;
  full_name: string;
  patient_code: string;
}

interface DupMatch {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
}

const INPUT =
  "w-full rounded border border-[#e4e4e7] px-3 py-2 text-sm text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20";
const LABEL = "text-sm font-medium text-[#4d4d4d]";
const BTN =
  "rounded bg-[#ec4899] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] disabled:opacity-50";
const CARD =
  "rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]";

const CHANNELS = [
  { id: "WALK_IN", label: "Khách tới trực tiếp" },
  { id: "HOTLINE", label: "Hotline" },
  { id: "ZALO_PK", label: "Zalo" },
  { id: "FB_DR4WOMEN", label: "Facebook" },
  { id: "REFERRAL", label: "Giới thiệu" },
];
const DURATIONS = [15, 30, 45, 60];

export default function NewPatientForm({
  locations,
  services,
  doctors,
}: {
  locations: Option[];
  services: Option[];
  doctors: Option[];
}) {
  // ---- Patient step state ----
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [cccd, setCccd] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dupes, setDupes] = useState<DupMatch[] | null>(null);

  const [created, setCreated] = useState<CreatedPatient | null>(null);

  // ---- Appointment step state ----
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [apptLocation, setApptLocation] = useState(locations[0]?.id ?? "");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [channel, setChannel] = useState("WALK_IN");
  const [apptError, setApptError] = useState<string | null>(null);
  const [apptSubmitting, setApptSubmitting] = useState(false);
  const [apptDoneId, setApptDoneId] = useState<string | null>(null);

  async function createPatient(force: boolean) {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        date_of_birth: dob,
        phone_primary: phone,
        phone_secondary: phone2,
        national_id_number: cccd,
        location_id: locationId,
        force,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error ?? "Có lỗi xảy ra.");
      return;
    }
    if (json.duplicate) {
      setDupes(json.matches as DupMatch[]);
      return;
    }
    setDupes(null);
    setCreated(json.patient as CreatedPatient);
    setApptLocation(locationId);
  }

  function useExisting(m: DupMatch) {
    setDupes(null);
    setCreated({
      clinic_patient_id: m.clinic_patient_id,
      full_name: m.full_name,
      patient_code: m.patient_code,
    });
    setApptLocation(locationId);
  }

  async function bookAppointment() {
    if (!created) return;
    setApptError(null);
    setApptSubmitting(true);
    const start = new Date(`${apptDate}T${apptTime}`);
    const end = new Date(start.getTime() + duration * 60_000);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_patient_id: created.clinic_patient_id,
        doctor_id: doctorId,
        service_type_id: serviceId,
        location_id: apptLocation,
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        booking_channel: channel,
      }),
    });
    const json = await res.json();
    setApptSubmitting(false);
    if (!res.ok) {
      setApptError(json.error ?? "Có lỗi xảy ra.");
      return;
    }
    setApptDoneId(json.appointment_id as string);
  }

  function reset() {
    setFullName("");
    setDob("");
    setPhone("");
    setPhone2("");
    setCccd("");
    setError(null);
    setDupes(null);
    setCreated(null);
    setDoctorId("");
    setServiceId("");
    setApptDate("");
    setApptTime("");
    setApptError(null);
    setApptDoneId(null);
  }

  // ---- STEP 2: appointment booked → success ----
  if (apptDoneId && created) {
    return (
      <div className={`${CARD} space-y-3`}>
        <p className="rounded bg-[#dcfce7] px-3 py-2 text-sm text-[#15803d]">
          ✓ Đã tạo bệnh nhân <b>{created.full_name}</b> ({created.patient_code})
          và đặt lịch hẹn.
        </p>
        <div className="flex gap-2">
          <Link
            href={`/patients/${created.clinic_patient_id}`}
            className="rounded border border-[#e4e4e7] px-4 py-2 text-sm text-[#171717] hover:bg-[#f4f4f5]"
          >
            Xem hồ sơ BN
          </Link>
          <button onClick={reset} className={BTN}>
            Nhập BN khác
          </button>
        </div>
      </div>
    );
  }

  // ---- STEP 2: patient created → appointment form ----
  if (created) {
    const canBook = serviceId && apptLocation && apptDate && apptTime;
    return (
      <div className={`${CARD} space-y-4`}>
        <p className="rounded bg-[#dcfce7] px-3 py-2 text-sm text-[#15803d]">
          ✓ Bệnh nhân <b>{created.full_name}</b> ({created.patient_code}) đã sẵn
          sàng. Đặt lịch hẹn (hoặc bỏ qua).
        </p>

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
              value={apptLocation}
              onChange={(e) => setApptLocation(e.target.value)}
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

        {apptError && (
          <p className="rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
            {apptError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={bookAppointment}
            disabled={!canBook || apptSubmitting}
            className={BTN}
          >
            {apptSubmitting ? "Đang đặt..." : "Đặt lịch hẹn"}
          </button>
          <button
            onClick={() => setApptDoneId("skipped")}
            className="rounded border border-[#e4e4e7] px-4 py-2 text-sm text-[#71717a] hover:bg-[#f4f4f5]"
          >
            Bỏ qua, chỉ tạo BN
          </button>
        </div>
      </div>
    );
  }

  // ---- STEP 1: patient form ----
  const canCreate = fullName.trim() && locationId;
  return (
    <div className={`${CARD} space-y-4`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={LABEL}>Họ tên *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT}
            placeholder="Nguyễn Thị A"
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Ngày sinh</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>SĐT chính</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={INPUT}
            placeholder="09xxxxxxxx"
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>SĐT phụ</label>
          <input
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>CCCD</label>
          <input
            value={cccd}
            onChange={(e) => setCccd(e.target.value)}
            className={INPUT}
          />
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
      </div>

      {/* Duplicate-phone warning */}
      {dupes && dupes.length > 0 && (
        <div className="space-y-2 rounded-md bg-[#fef9c3] px-3 py-3 text-sm text-[#a16207]">
          <p>
            ⚠️ Đã có bệnh nhân dùng SĐT này. Chọn đúng người, hoặc vẫn tạo mới:
          </p>
          <ul className="space-y-1">
            {dupes.map((m) => (
              <li
                key={m.clinic_patient_id}
                className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1"
              >
                <span className="text-[#171717]">
                  {m.full_name}{" "}
                  <span className="font-mono text-xs text-[#888888]">
                    {m.patient_code}
                  </span>
                  {m.date_of_birth ? (
                    <span className="ml-2 text-xs text-[#888888]">
                      {m.date_of_birth}
                    </span>
                  ) : null}
                </span>
                <button
                  onClick={() => useExisting(m)}
                  className="rounded bg-[#ec4899] px-2 py-1 text-xs font-medium text-white hover:bg-[#db2777]"
                >
                  Dùng BN này
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => createPatient(true)}
            disabled={submitting}
            className="text-xs font-medium text-[#dc2626] underline disabled:opacity-50"
          >
            Vẫn tạo bệnh nhân mới
          </button>
        </div>
      )}

      {error && (
        <p className="rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </p>
      )}

      <button
        onClick={() => createPatient(false)}
        disabled={!canCreate || submitting}
        className={BTN}
      >
        {submitting ? "Đang lưu..." : "Tạo bệnh nhân"}
      </button>
    </div>
  );
}
