// Trang Lịch hẹn khám (Check-in bệnh nhân) riêng biệt cho Lễ tân / Quản lý / Điều dưỡng.
import HomeCheckin, { type HomeCheckinRow } from "../home/HomeCheckin";
import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  getClinicRole,
  getClinicStaffId,
  requireNavAccess,
} from "../../../lib/clinic-session";
import { canWriteClinical } from "../../../lib/roles";
import { vnTodayRangeUtc, fmtDate } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

export default async function ReceptionCheckinPage() {
  await requireNavAccess("/reception-checkin");

  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const staffId = await getClinicStaffId();
  const writeClinical = canWriteClinical(role);
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // Check-in hôm nay (đủ trường hành chính để mở hồ sơ lâm sàng ở cột phải).
  const CHECKIN_SELECT = `
    id, slot_start, status, queue_number,
    patient:patient!clinic_patient_id (
      clinic_patient_id, patient_code, full_name, date_of_birth,
      phone_primary, phone_secondary, gender, ethnicity, nationality, occupation,
      patient_objection, address, guardian_name
    ),
    service:service_type!service_type_id ( name )
  `;

  const { data } = await supabase
    .from("appointment")
    .select(CHECKIN_SELECT)
    .gte("slot_start", dayStart)
    .lt("slot_start", dayEnd)
    .in("status", [
      "SCHEDULED",
      "CSKH_CONFIRMED",
      "CONFIRMED",
      "CHECKED_IN",
      "COMPLETED",
    ])
    .order("slot_start", { ascending: true })
    .limit(300);

  const checkinRows = (data as HomeCheckinRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Lịch hẹn khám</h1>
        <p className="text-sm text-[#888888]">Hôm nay · {fmtDate(new Date())}</p>
      </header>

      <HomeCheckin
        rows={checkinRows}
        staffId={staffId}
        canWriteClinical={writeClinical}
        defaultOpen={true}
      />
    </div>
  );
}
