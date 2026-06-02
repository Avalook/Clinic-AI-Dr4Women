"use client";

import { useState } from "react";
import Link from "next/link";
import AppointmentBooking, { type Option } from "../AppointmentBooking";

export type { Option };

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

// text-base on mobile (16px) prevents iOS auto-zoom on focus; min-h gives a
// comfortable tap target. Shrinks to denser desktop sizing at ≥sm.
const INPUT =
  "w-full min-h-11 rounded-md border border-[#e4e4e7] px-3 py-2.5 text-base text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20 sm:min-h-0 sm:py-2 sm:text-sm";
const LABEL = "text-sm font-medium text-[#4d4d4d]";
const BTN =
  "min-h-11 w-full rounded-md bg-[#ec4899] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2";
const CARD =
  "rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]";

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

  // ---- Appointment step ----
  // The booking form itself lives in <AppointmentBooking>; here we only track
  // whether this intake's booking step is done ("skipped" or an appointment id).
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
  }

  function pickExisting(m: DupMatch) {
    setDupes(null);
    setCreated({
      clinic_patient_id: m.clinic_patient_id,
      full_name: m.full_name,
      patient_code: m.patient_code,
    });
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/patients/${created.clinic_patient_id}`}
            className="flex min-h-11 w-full items-center justify-center rounded-md border border-[#e4e4e7] px-4 py-2.5 text-sm text-[#171717] hover:bg-[#f4f4f5] active:bg-[#f4f4f5] sm:min-h-0 sm:w-auto sm:py-2"
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
    return (
      <div className={`${CARD} space-y-4`}>
        <p className="rounded bg-[#dcfce7] px-3 py-2 text-sm text-[#15803d]">
          ✓ Bệnh nhân <b>{created.full_name}</b> ({created.patient_code}) đã sẵn
          sàng. Đặt lịch hẹn (hoặc bỏ qua).
        </p>

        <AppointmentBooking
          clinicPatientId={created.clinic_patient_id}
          services={services}
          doctors={doctors}
          locations={locations}
          defaultLocationId={locationId}
          onBooked={(apptId) => setApptDoneId(apptId)}
          secondary={
            <button
              onClick={() => setApptDoneId("skipped")}
              className="min-h-11 w-full rounded-md border border-[#e4e4e7] px-4 py-2.5 text-sm text-[#71717a] hover:bg-[#f4f4f5] active:bg-[#f4f4f5] sm:min-h-0 sm:w-auto sm:py-2"
            >
              Bỏ qua, chỉ tạo BN
            </button>
          }
        />
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
                className="flex flex-col gap-2 rounded bg-white px-2 py-2 sm:flex-row sm:items-center sm:justify-between"
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
                  onClick={() => pickExisting(m)}
                  className="min-h-10 shrink-0 rounded-md bg-[#ec4899] px-3 py-2 text-xs font-medium text-white hover:bg-[#db2777] active:bg-[#db2777] sm:min-h-0 sm:py-1"
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
