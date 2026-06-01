// Patient detail: admin info + appointment history + clinical history
// (visits/SOAP, lab results, pregnancy). The clinical history is the
// doctor's "bệnh án / tiền sử khám" view.
// SECURITY: national_id_number (CCCD) is intentionally NOT selected — D-identity.

import PatientDetail from "./PatientDetail";
import PatientHistory from "./PatientHistory";
import PatientBooking from "./PatientBooking";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { getClinicRole } from "../../../../lib/clinic-session";
import { canWriteIntake } from "../../../../lib/roles";
import type { Option } from "../AppointmentBooking";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Booking is an intake action (CSKH / Lễ tân / Quản lý). Only those roles see
  // the form, so only load its dropdown options when they will be used.
  const role = await getClinicRole();
  const canBook = canWriteIntake(role);

  let services: Option[] = [];
  let doctors: Option[] = [];
  let locations: Option[] = [];
  if (canBook) {
    const supabase = await getSupabaseServer();
    const [locRes, svcRes, docRes] = await Promise.all([
      supabase.from("clinic_location").select("id, name").order("name"),
      supabase.from("service_type").select("id, name").order("name"),
      supabase
        .from("staff")
        .select("id, full_name")
        .in("primary_department", ["DOCTOR", "ULTRASOUND_DOCTOR"])
        .eq("is_active", true)
        .order("full_name"),
    ]);
    locations = (locRes.data ?? []).map((r) => ({
      id: r.id as string,
      label: r.name as string,
    }));
    services = (svcRes.data ?? []).map((r) => ({
      id: r.id as string,
      label: r.name as string,
    }));
    doctors = (docRes.data ?? []).map((r) => ({
      id: r.id as string,
      label: r.full_name as string,
    }));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Chi tiết BN</h1>
        <p className="text-sm text-gray-500">
          Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
        </p>
      </header>
      <PatientDetail id={id} />
      {canBook && (
        <PatientBooking
          clinicPatientId={id}
          services={services}
          doctors={doctors}
          locations={locations}
        />
      )}
      <PatientHistory id={id} />
    </div>
  );
}
