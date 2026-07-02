// CSKH / Lễ tân intake: create a patient, then optionally book an
// appointment. Writes go through /api/patients + /api/appointments
// (service-role); this page only loads the dropdown options.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { getSupabaseService } from "../../../../lib/supabase-service";
import { getClinicRole } from "../../../../lib/clinic-session";
import { canWriteIntake, isNurseRole } from "../../../../lib/roles";
import NewPatientForm, { type Option, type ProvinceOpt } from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; doctor?: string }>;
}) {
  // Ô xanh "đặt vào đây" (bảng Lịch hẹn khám trang chủ) dẫn sang đây kèm
  // ?date&time&doctor để điền sẵn khung + bác sĩ cho khách vãng lai.
  const { date: qDate, time: qTime, doctor: qDoctor } = await searchParams;
  const role = await getClinicRole();
  if (!canWriteIntake(role)) redirect("/home");
  const nurse = isNurseRole(role);

  const supabase = await getSupabaseServer();
  // province/ward có RLS bật nhưng KHÔNG có policy SELECT → client authenticated đọc
  // 0 dòng. Đọc bằng SERVICE-ROLE (data tham chiếu công khai, server-only, an toàn).
  const service = getSupabaseService();
  const [locRes, svcRes, docRes, provRes] = await Promise.all([
    supabase.from("clinic_location").select("id, name").order("name"),
    supabase.from("service_type").select("id, name").order("name"),
    supabase
      .from("staff")
      .select("id, full_name")
      .in("primary_department", ["DOCTOR", "ULTRASOUND_DOCTOR"])
      .eq("is_active", true)
      .order("full_name"),
    // 34 tỉnh/thành sau sáp nhập — phường/xã load runtime theo tỉnh (/api/wards).
    service
      ? service.from("province").select("code, name, full_name").order("name")
      : Promise.resolve({ data: [] as { code: string; name: string; full_name: string }[] }),
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
  const provinces: ProvinceOpt[] = (provRes.data ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    fullName: r.full_name as string,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          {role === "CSKH" ? "Nhập thông tin khách hàng mới" : "Tạo bệnh nhân"}
        </h1>
      </header>
      <NewPatientForm
        role={role}
        locations={locations}
        services={services}
        doctors={doctors}
        provinces={provinces}
        variant={(nurse || role === "RECEPTION") ? "walkin" : "full"}
        initialAppt={
          qDate || qTime || qDoctor
            ? { date: qDate, time: qTime, doctorId: qDoctor }
            : undefined
        }
      />
    </div>
  );
}
