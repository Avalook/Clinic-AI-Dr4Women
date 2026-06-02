// Server component: one patient's admin info + their appointment history.
// SECURITY: national_id_number (CCCD) is NOT selected — D-identity gate.

import Link from "next/link";
import StatusBadge from "../../StatusBadge";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { fmtDateTime } from "../../../../lib/datetime";

interface PatientRow {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  phone_primary: string | null;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  slot_start: string;
  status: string;
  booking_channel: string | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

const PATIENT_COLUMNS =
  "clinic_patient_id, patient_code, full_name, date_of_birth, phone_primary, created_at";

// doctor is a LEFT JOIN (doctor_id is nullable).
const APPOINTMENT_COLUMNS = `
  id, slot_start, status, booking_channel,
  doctor:staff!doctor_id ( full_name ),
  service:service_type!service_type_id ( name )
`;

function ageFromDob(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return String(age);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-[#888888]">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-[#171717]">{value}</dd>
    </div>
  );
}

export default async function PatientDetail({ id }: { id: string }) {
  const supabase = await getSupabaseServer();

  const [patientRes, apptRes] = await Promise.all([
    supabase
      .from("patient")
      .select(PATIENT_COLUMNS)
      .eq("clinic_patient_id", id)
      .maybeSingle(),
    supabase
      .from("appointment")
      .select(APPOINTMENT_COLUMNS)
      .eq("clinic_patient_id", id)
      .order("slot_start", { ascending: false })
      .limit(20),
  ]);

  const patient = patientRes.data as PatientRow | null;
  const error = patientRes.error ?? apptRes.error;
  const appointments = (apptRes.data as AppointmentRow[] | null) ?? [];

  if (error) {
    return (
      <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
        {error.message}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#e4e4e7] bg-white px-3 py-6 text-center text-[#888888]">
          Không tìm thấy bệnh nhân.
        </div>
        <Link
          href="/patients"
          className="text-sm text-[#ec4899] hover:underline"
        >
          ← Về danh sách BN
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/patients" className="text-sm text-[#ec4899] hover:underline">
        ← Về danh sách BN
      </Link>

      <section className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-4 border-b border-[#f4f4f5] bg-gradient-to-r from-[#fdf2f8] to-white p-4 sm:p-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#ec4899] text-xl font-semibold text-white">
            {patient.full_name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[#171717]">
              {patient.full_name}
            </h2>
            <p className="mt-0.5 font-mono text-sm text-[#888888]">
              {patient.patient_code}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-4 sm:gap-x-6 sm:p-6">
          <Field label="Ngày sinh" value={patient.date_of_birth ?? "—"} />
          <Field label="Tuổi" value={ageFromDob(patient.date_of_birth)} />
          <Field label="SĐT" value={patient.phone_primary ?? "—"} />
          <Field
            label="Số lịch hẹn"
            value={appointments.length >= 20 ? "20+" : String(appointments.length)}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[#171717]">
          Lịch sử lịch hẹn
        </h3>

        {/* Mobile: card list (<md). */}
        <div className="space-y-2 md:hidden">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-[#4d4d4d]">
                  {fmtDateTime(a.slot_start)}
                </span>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-1 text-sm text-[#171717]">
                {a.service?.name ?? "—"}
              </p>
              <p className="text-xs text-[#4d4d4d]">
                BS {a.doctor?.full_name ?? "—"} ·{" "}
                {a.booking_channel ?? "—"}
              </p>
            </div>
          ))}
          {appointments.length === 0 && (
            <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-6 text-center text-sm text-[#888888]">
              Chưa có lịch hẹn.
            </div>
          )}
        </div>

        {/* Desktop: table (≥md). */}
        <div className="hidden overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] md:block">
          <table className="min-w-full divide-y divide-[#e4e4e7] text-sm">
            <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Ngày giờ</th>
                <th className="px-4 py-2.5 font-medium">Dịch vụ</th>
                <th className="px-4 py-2.5 font-medium">Bác sĩ</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 font-medium">Kênh đặt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f4f5]">
              {appointments.map((a) => (
                <tr
                  key={a.id}
                  className="transition-colors duration-150 hover:bg-[#f9fafb]"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-[#4d4d4d]">
                    {fmtDateTime(a.slot_start)}
                  </td>
                  <td className="px-4 py-2.5 text-[#171717]">
                    {a.service?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[#4d4d4d]">
                    {a.doctor?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-2.5 text-[#4d4d4d]">
                    {a.booking_channel ?? "—"}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-[#888888]"
                  >
                    Chưa có lịch hẹn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
