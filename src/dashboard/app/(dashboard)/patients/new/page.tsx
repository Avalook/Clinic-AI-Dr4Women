// CSKH / Lễ tân intake: create a patient, then optionally book an
// appointment. Writes go through /api/patients + /api/appointments
// (service-role); this page only loads the dropdown options.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { getClinicRole } from "../../../../lib/clinic-session";
import { canWriteIntake, isNurseRole } from "../../../../lib/roles";
import NewPatientForm, { type Option } from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const role = await getClinicRole();
  if (!canWriteIntake(role)) redirect("/home");
  const nurse = isNurseRole(role);

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
  // Lọc bỏ dịch vụ rác "FREE" (option import từ Notion) khỏi dropdown đặt lịch
  // — feedback B5#3 ("tại sao có chữ free trong dịch vụ khám").
  const services: Option[] = (svcRes.data ?? [])
    .filter((r) => (r.name as string)?.trim().toUpperCase() !== "FREE")
    .map((r) => ({
      id: r.id as string,
      label: r.name as string,
    }));
  const doctors: Option[] = (docRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.full_name as string,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          {nurse ? "Nhập thông tin khách vãng lai" : "Nhập thông tin khách hàng"}
        </h1>
      </header>
      <NewPatientForm
        locations={locations}
        services={services}
        doctors={doctors}
        variant={nurse ? "walkin" : "full"}
      />
    </div>
  );
}
