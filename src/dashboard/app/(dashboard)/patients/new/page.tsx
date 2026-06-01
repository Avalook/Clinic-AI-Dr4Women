// CSKH / Lễ tân intake: create a patient, then optionally book an
// appointment. Writes go through /api/patients + /api/appointments
// (service-role); this page only loads the dropdown options.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { getClinicRole } from "../../../../lib/clinic-session";
import { canWriteIntake } from "../../../../lib/roles";
import NewPatientForm, { type Option } from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const role = await getClinicRole();
  if (!canWriteIntake(role)) redirect("/home");

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

  const locations: Option[] = (locRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));
  const services: Option[] = (svcRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));
  const doctors: Option[] = (docRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.full_name as string,
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Nhập bệnh nhân mới
        </h1>
        <p className="text-sm text-[#888888]">
          Tạo hồ sơ bệnh nhân và đặt lịch hẹn.
        </p>
      </header>
      <NewPatientForm
        locations={locations}
        services={services}
        doctors={doctors}
      />
    </div>
  );
}
