// Server component: one patient's admin info + their appointment history.
// SECURITY: national_id_number (CCCD) is NOT selected — D-identity gate.

import Link from "next/link";
import { getSupabaseServer } from "../../../../lib/supabase-server";

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

function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
        {error.message}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-3">
        <div className="rounded bg-gray-50 px-3 py-6 text-center text-gray-500">
          Không tìm thấy bệnh nhân.
        </div>
        <Link href="/patients" className="text-sm text-blue-600 hover:underline">
          ← Về danh sách BN
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/patients" className="text-sm text-blue-600 hover:underline">
        ← Về danh sách BN
      </Link>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          {patient.full_name}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-gray-500">Mã BN</dt>
            <dd className="font-mono text-xs">{patient.patient_code}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Ngày sinh</dt>
            <dd className="font-mono text-xs">{patient.date_of_birth ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Tuổi</dt>
            <dd>{ageFromDob(patient.date_of_birth)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">SĐT</dt>
            <dd className="font-mono text-xs">{patient.phone_primary ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">
          Lịch sử lịch hẹn
        </h3>
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Ngày giờ</th>
                <th className="px-3 py-2">Dịch vụ</th>
                <th className="px-3 py-2">Bác sĩ</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Kênh đặt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {fmtDateTime(a.slot_start)}
                  </td>
                  <td className="px-3 py-2">{a.service?.name ?? "—"}</td>
                  <td className="px-3 py-2">{a.doctor?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{a.status}</td>
                  <td className="px-3 py-2">{a.booking_channel ?? "—"}</td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
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
