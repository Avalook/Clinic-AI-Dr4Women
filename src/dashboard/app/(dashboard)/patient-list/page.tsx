// "Danh sách bệnh nhân" — BN đã khám (lịch hẹn COMPLETED). Gom theo BN để suy
// "Khám lần đầu" (1 lần) / "Tái khám" (>=2 lần). Đọc qua Supabase RLS.

import { getSupabaseServer } from "../../../lib/supabase-server";
import { requireNavAccess } from "../../../lib/clinic-session";
import PatientListView, { type ExaminedRow } from "./PatientListView";

export const dynamic = "force-dynamic";

interface PatientLite {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  phone_primary: string | null;
  date_of_birth: string | null;
  gender: string | null;
}
interface ApptJoin {
  clinic_patient_id: string;
  slot_start: string;
  patient: PatientLite | PatientLite[] | null;
}

const SELECT = `
  clinic_patient_id, slot_start,
  patient:patient!clinic_patient_id (
    clinic_patient_id, patient_code, full_name, phone_primary, date_of_birth, gender
  )
`;

export default async function PatientListPage() {
  await requireNavAccess("/patient-list");
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
    const p = Array.isArray(a.patient) ? a.patient[0] : a.patient;
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
        <PatientListView rows={rows} />
      )}
    </div>
  );
}
