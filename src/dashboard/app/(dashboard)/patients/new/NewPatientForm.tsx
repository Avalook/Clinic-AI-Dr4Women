"use client";

// Single-step intake: patient details + (optional) first appointment on ONE
// form. One submit creates the patient (MPI dup-check) then books the
// appointment if a service + date + time were filled, and finally lands on the
// patient's profile. No more two-screen flow.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRound, CalendarClock } from "lucide-react";
import type { Option } from "../AppointmentBooking";
import { vnLocalToUtcISO } from "../../../../lib/datetime";
import {
  INPUT,
  LABEL,
  BTN,
  BTN_GHOST,
  CARD,
  CHANNELS,
  DURATIONS,
} from "../../form-ui";

export type { Option };

interface DupMatch {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
}

function Req() {
  return <span className="text-[#ec4899]">*</span>;
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-[#f4f4f5] pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fce7f3] text-[#db2777]">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
        {hint && <p className="text-xs text-[#888888]">{hint}</p>}
      </div>
    </div>
  );
}

export default function NewPatientForm({
  locations,
  services,
  doctors,
  variant = "full",
}: {
  locations: Option[];
  services: Option[];
  doctors: Option[];
  /** "walkin" = điều dưỡng ghi khách vãng lai: bỏ lịch hẹn, gộp dịch vụ/bác sĩ
   *  vào ô thông tin, lưu xong tạo luôn lượt khám HÔM NAY (giờ hiện tại). */
  variant?: "full" | "walkin";
}) {
  const walkin = variant === "walkin";
  const router = useRouter();

  // Patient
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  // Năm sinh-only (feedback B5#4): BN chỉ nhớ năm → bật toggle, nhập năm.
  const [dobYearOnly, setDobYearOnly] = useState(false);
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [cccd, setCccd] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  // Hành chính (mục I form khám) — đồng bộ sang hồ sơ lâm sàng.
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("Kinh");
  const [nationality, setNationality] = useState("Việt Nam");
  const [occupation, setOccupation] = useState("");
  const [objection, setObjection] = useState("");
  const [address, setAddress] = useState("");

  // Appointment (optional)
  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [channel, setChannel] = useState("WALK_IN");
  // Số khám (queue_number) — feedback B5#8.
  const [queueNumber, setQueueNumber] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dupes, setDupes] = useState<DupMatch[] | null>(null);

  // Walk-in: chỉ cần chọn dịch vụ là tạo lượt khám (giờ = bây giờ). Full: cần đủ
  // dịch vụ + ngày + giờ.
  const wantsAppointment = walkin
    ? !!serviceId
    : !!(serviceId && apptDate && apptTime);
  const canSubmit = fullName.trim() && locationId && !submitting;

  async function bookFor(clinicPatientId: string): Promise<boolean> {
    if (!wantsAppointment) return true;
    const start = walkin
      ? new Date()
      : new Date(vnLocalToUtcISO(apptDate, apptTime));
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
        booking_channel: walkin ? "WALK_IN" : channel,
        queue_number: queueNumber,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(
        `Đã tạo hồ sơ nhưng đặt lịch lỗi: ${json.error ?? "không rõ"}. Mở hồ sơ để đặt lại.`,
      );
      return false;
    }
    return true;
  }

  // Land on the patient profile (the "nice profile" the user sees right after).
  // Kèm mã BN để banner hiện "Mã BN: …" ngay sau khi tạo (feedback B5#2).
  function goToProfile(id: string, code?: string) {
    const q = code ? `?new=1&code=${encodeURIComponent(code)}` : "?new=1";
    router.push(`/patients/${id}${q}`);
  }

  async function proceed(clinicPatientId: string, code?: string) {
    const booked = await bookFor(clinicPatientId);
    if (!booked) {
      // Patient exists; let the operator open the profile to retry booking.
      setSubmitting(false);
      setDupes(null);
      return;
    }
    goToProfile(clinicPatientId, code);
  }

  async function save(force: boolean) {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        date_of_birth: dobYearOnly ? "" : dob,
        birth_year: dobYearOnly ? birthYear : undefined,
        phone_primary: phone,
        phone_secondary: phone2,
        national_id_number: cccd,
        location_id: locationId,
        gender,
        ethnicity,
        nationality,
        occupation,
        patient_objection: objection,
        address,
        force,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSubmitting(false);
      setError(json.error ?? "Có lỗi xảy ra.");
      return;
    }
    if (json.duplicate) {
      setSubmitting(false);
      setDupes(json.matches as DupMatch[]);
      return;
    }
    await proceed(
      json.patient.clinic_patient_id as string,
      json.patient.patient_code as string,
    );
  }

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <SectionHeader
          icon={<UserRound size={16} />}
          title={walkin ? "Thông tin khách vãng lai" : "Thông tin khách hàng"}
          hint={
            walkin
              ? "Họ tên bắt buộc · chọn dịch vụ + bác sĩ để tạo lượt khám hôm nay."
              : "Họ tên là bắt buộc; còn lại điền nếu có."
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>
              Họ tên <Req />
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT}
              placeholder="Nguyễn Thị A"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={LABEL + " mb-0"}>
                {dobYearOnly ? "Năm sinh" : "Ngày sinh"}
              </label>
              <label className="flex cursor-pointer items-center gap-1 text-[12px] text-[#888888]">
                <input
                  type="checkbox"
                  checked={dobYearOnly}
                  onChange={(e) => setDobYearOnly(e.target.checked)}
                  className="accent-[#ec4899]"
                />
                Chỉ biết năm
              </label>
            </div>
            {dobYearOnly ? (
              <input
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className={INPUT}
                placeholder="VD: 1990"
              />
            ) : (
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={INPUT}
              />
            )}
          </div>
          <div>
            <label className={LABEL}>SĐT chính</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={INPUT}
              placeholder="09xxxxxxxx"
              inputMode="tel"
            />
          </div>
          <div>
            <label className={LABEL}>SĐT người nhà (nếu có)</label>
            <input
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              className={INPUT}
              inputMode="tel"
            />
          </div>
          <div>
            <label className={LABEL}>CCCD (nếu cung cấp)</label>
            <input
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              className={INPUT}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={LABEL}>
              Cơ sở đăng ký khám <Req />
            </label>
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
          <div>
            <label className={LABEL}>Giới tính</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={INPUT}
            >
              <option value="">— Chọn —</option>
              <option value="Nữ">Nữ</option>
              <option value="Nam">Nam</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Dân tộc</label>
            <input
              value={ethnicity}
              onChange={(e) => setEthnicity(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Quốc tịch</label>
            <input
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Nghề nghiệp</label>
            <input
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Đối tượng</label>
            <input
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              className={INPUT}
              placeholder="DV / BHYT / ..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Địa chỉ</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={INPUT}
              placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
            />
          </div>

          {/* Walk-in: Dịch vụ + Bác sĩ nằm CÙNG ô thông tin (không có lịch hẹn). */}
          {walkin && (
            <>
              <div>
                <label className={LABEL}>Dịch vụ khám</label>
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
              <div>
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
            </>
          )}
        </div>
      </section>

      {!walkin && (
      <section className={CARD}>
        <SectionHeader
          icon={<CalendarClock size={16} />}
          title="Lịch hẹn khám"
          hint="Điền dịch vụ + ngày + giờ để đặt lịch luôn (có thể bỏ trống)."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Dịch vụ khám</label>
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
          <div>
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
          <div>
            <label className={LABEL}>Ngày khám</label>
            <input
              type="date"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Giờ</label>
            <input
              type="time"
              step={60}
              value={apptTime}
              onChange={(e) => setApptTime(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Số khám</label>
            <input
              value={queueNumber}
              onChange={(e) => setQueueNumber(e.target.value)}
              className={INPUT}
              placeholder="VD: 5 / ƯT1 (tuỳ chọn)"
            />
          </div>
          <div>
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
          <div>
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
      </section>
      )}

      {/* Duplicate-phone warning */}
      {dupes && dupes.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#a16207]">
          <p className="font-medium">
            ⚠️ Đã có khách hàng dùng SĐT này. Chọn đúng người để đặt lịch, hoặc
            vẫn tạo mới:
          </p>
          <ul className="space-y-1.5">
            {dupes.map((m) => (
              <li
                key={m.clinic_patient_id}
                className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-[#171717]">
                  {m.full_name}{" "}
                  <span className="font-mono text-xs text-[#888888]">
                    {m.patient_code}
                  </span>
                  {m.date_of_birth && (
                    <span className="ml-2 text-xs text-[#888888]">
                      {m.date_of_birth}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => proceed(m.clinic_patient_id)}
                  disabled={submitting}
                  className="min-h-10 shrink-0 rounded-lg bg-[#ec4899] px-3 py-2 text-xs font-semibold text-white hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-50 sm:min-h-0 sm:py-1.5"
                >
                  Dùng khách này
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => save(true)}
            disabled={submitting}
            className="text-xs font-medium text-[#dc2626] underline disabled:opacity-50"
          >
            Vẫn tạo khách hàng mới
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-2 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#dc2626]">
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button onClick={() => save(false)} disabled={!canSubmit} className={BTN}>
          {submitting
            ? "Đang lưu..."
            : walkin
              ? wantsAppointment
                ? "Tạo khách vãng lai & lượt khám"
                : "Tạo khách vãng lai"
              : wantsAppointment
                ? "Tạo hồ sơ & đặt lịch"
                : "Tạo hồ sơ khách hàng"}
        </button>
        <Link href="/patients" className={BTN_GHOST + " text-center"}>
          Huỷ
        </Link>
      </div>
    </div>
  );
}
