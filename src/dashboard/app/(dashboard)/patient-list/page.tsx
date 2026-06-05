// "Danh sách bệnh nhân" — BN đã khám (lịch hẹn COMPLETED). Gom theo BN để suy
// "Khám lần đầu" (1 lần) / "Tái khám" (>=2 lần). Đọc qua Supabase RLS.
//
// Bấm tên BN: LỄ TÂN + BÁC SĨ + CSKH → BẬT POPUP hồ sơ lâm sàng (CHỈ ĐỌC lâm
// sàng, SỬA được mục I Hành chính) trượt sang PHẢI bảng (SplitPane, y hệt "Công
// việc của tôi" của bác sĩ), lần khám gần nhất. Quản lý → vẫn điều hướng sang
// trang chi tiết (còn nút đặt lịch ở đó). Server quyết enablePopup theo vai trò.

import { getSupabaseServer } from "../../../lib/supabase-server";
import { requireNavAccess, getClinicRole } from "../../../lib/clinic-session";
import { isTasksReadOnly, isDoctorRole } from "../../../lib/roles";
import PatientListView, { type ExaminedRow } from "./PatientListView";
import type { DoctorApptRow } from "../tasks/DoctorWorkBoard";

export const dynamic = "force-dynamic";

// Đủ trường để dựng hồ sơ lâm sàng (mục I Hành chính) trong popup.
type PatientFull = NonNullable<DoctorApptRow["patient"]>;
interface ApptJoin {
  id: string;
  status: string;
  queue_number: string | null;
  slot_start: string;
  patient: PatientFull | PatientFull[] | null;
  service: { name: string } | { name: string }[] | null;
}

const SELECT = `
  id, status, queue_number, slot_start,
  patient:patient!clinic_patient_id (
    clinic_patient_id, patient_code, full_name, date_of_birth,
    phone_primary, phone_secondary, gender, ethnicity, nationality,
    occupation, patient_objection, address, guardian_name
  ),
  service:service_type!service_type_id ( name )
`;

const one = <T,>(x: T | T[] | null): T | null =>
  !x ? null : Array.isArray(x) ? (x[0] ?? null) : x;

export default async function PatientListPage() {
  await requireNavAccess("/patient-list");
  const role = await getClinicRole();
  // Lễ tân + Bác sĩ + CSKH: bấm BN bật popup hồ sơ (chỉ đọc lâm sàng, sửa được
  // hành chính) trượt sang phải — y hệt nhau. Quản lý giữ điều hướng sang trang
  // chi tiết (còn nút đặt lịch tái khám ở đó; trang đó cũng đã sửa được hành chính).
  const enablePopup =
    isTasksReadOnly(role) || isDoctorRole(role) || role === "CSKH";
  const supabase = await getSupabaseServer();

  // COMPLETED = đã khám xong. Sắp xếp mới→cũ để lần xuất hiện ĐẦU của mỗi BN
  // chính là lần khám gần nhất. Cap 2000 lượt khám gần nhất (đủ rộng cho MVP
  // nhập tay; vượt thì BN khám rất lâu trước có thể sót — chấp nhận được).
  const { data, error } = await supabase
    .from("appointment")
    .select(SELECT)
    .eq("status", "COMPLETED")
    .order("slot_start", { ascending: false })
    .limit(2000);

  const raw = (data as ApptJoin[] | null) ?? [];
  const map = new Map<string, ExaminedRow>();
  for (const a of raw) {
    const p = one(a.patient);
    if (!p) continue;
    const cur = map.get(p.clinic_patient_id);
    if (cur) {
      cur.visit_count += 1;
    } else {
      map.set(p.clinic_patient_id, {
        clinic_patient_id: p.clinic_patient_id,
        patient_code: p.patient_code,
        full_name: p.full_name,
        phone_primary: p.phone_primary,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        visit_count: 1,
        latest: a.slot_start, // lần xuất hiện đầu = gần nhất (đã order desc)
        phan_loai: "Khám lần đầu",
        // Lượt khám GẦN NHẤT — mở trong popup hồ sơ lâm sàng (chỉ đọc).
        appt: {
          id: a.id,
          slot_start: a.slot_start,
          status: a.status,
          queue_number: a.queue_number,
          patient: p,
          service: one(a.service),
        },
      });
    }
  }
  const rows: ExaminedRow[] = [...map.values()]
    .map(
      (r): ExaminedRow => ({
        ...r,
        phan_loai: r.visit_count >= 2 ? "Tái khám" : "Khám lần đầu",
      }),
    )
    .sort((a, b) => (a.latest < b.latest ? 1 : -1));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Danh sách bệnh nhân
        </h1>
      </header>

      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        // canEditAdmin = enablePopup: Lễ tân + Bác sĩ vừa mở popup vừa sửa được
        // mục I Hành chính (PATCH /api/patients, server gate canEditPatient).
        <PatientListView
          rows={rows}
          enablePopup={enablePopup}
          canEditAdmin={enablePopup}
        />
      )}
    </div>
  );
}
