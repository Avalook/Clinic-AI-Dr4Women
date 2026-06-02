// Check-in bệnh nhân — Lễ tân xác nhận khách đã đến cho lịch hẹn HÔM NAY.
// Dữ liệu thật từ Supabase (appointment hôm nay, trạng thái SCHEDULED/CONFIRMED/
// CHECKED_IN). Check-in: → CHECKED_IN; hoàn tác: → CONFIRMED. Ghi qua
// /api/appointments (service-role). CCCD không hiển thị (D-identity).

import { redirect } from "next/navigation";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole } from "../../../lib/clinic-session";
import { canSeeNav } from "../../../lib/roles";
import { vnTodayRangeUtc } from "../../../lib/datetime";
import CheckinList, { type CheckinRow } from "./CheckinList";

export const dynamic = "force-dynamic";

const SELECT = `
  id, clinic_patient_id, queue_number, slot_start, status,
  patient:patient!clinic_patient_id ( full_name, phone_primary, patient_code ),
  doctor:staff!doctor_id ( full_name ),
  service:service_type!service_type_id ( name )
`;

export default async function CheckinPage() {
  const role = await getClinicRole();
  if (!canSeeNav(role, "/checkin")) redirect("/home");

  const supabase = await getSupabaseServer();
  const { startUtc, endUtc } = vnTodayRangeUtc();
  const { data, error } = await supabase
    .from("appointment")
    .select(SELECT)
    .gte("slot_start", startUtc)
    .lt("slot_start", endUtc)
    .in("status", ["SCHEDULED", "CONFIRMED", "CHECKED_IN"])
    .order("slot_start", { ascending: true })
    .limit(300);

  const rows = (data as CheckinRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Check-in bệnh nhân
        </h1>
        <p className="text-sm text-[#888888]">
          Lịch hẹn hôm nay — xác nhận khách đã đến.
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <CheckinList rows={rows} />
      )}
    </div>
  );
}
