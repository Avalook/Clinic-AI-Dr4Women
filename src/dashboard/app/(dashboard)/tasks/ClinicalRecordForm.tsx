"use client";

// Hồ sơ lâm sàng (TÓM TẮT KHÁM BỆNH) — panel bên phải board "Công việc của tôi".
//   I Hành chính ← patient · III/IV Tiền sử ← patient_medical_profile ·
//   V Thai ← pregnancy · VI Cận lâm sàng ← lab_result  (đều ĐỒNG BỘ, read-only).
//   Sinh hiệu, II Lý do, V bệnh sử/khám thai, VII Chuẩn đoán, VIII Lời dặn = BÁC SĨ
//   điền → LƯU NHÁP vào visit (IN_PROGRESS) + clinical_record qua /api/clinical-record.
// AN TOÀN: nếu visit đã FINALIZED → khóa (luật cấm sửa). KHÔNG tự chốt hồ sơ.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { fmtDate, fmtDateTimeOrDate } from "../../../lib/datetime";
import { INPUT, LABEL } from "../form-ui";
import PatientAdminEditor from "../PatientAdminEditor";
import type { DoctorApptRow } from "./DoctorWorkBoard";

interface Profile {
  blood_type: string | null;
  allergies: string[] | null;
  chronic_diseases: string[] | null;
  current_medications: string[] | null;
  surgical_history: string[] | null;
  family_history: unknown;
  notes: string | null;
}
interface Pregnancy {
  edd_date: string | null;
  gestational_age_at_registration: number | null;
  is_high_risk: boolean | null;
  high_risk_reason: string | null;
}
interface Lab {
  test_name: string;
  result_value: string | null;
  result_numeric: number | null;
  result_unit: string | null;
  flag: string | null;
  external_ref: string | null;
}
interface HistoryItem {
  visit_id: string;
  created_at: string;
  status: string;
  service: string | null;
  doctor: string | null;
  chief_complaint: string;
  assessment: string;
}
interface ApiRx {
  drug_name_raw: string | null;
  quantity: string | null;
  dosage_instructions: string | null;
  caution: string | null;
}
interface Data {
  profile: Profile | null;
  pregnancy: Pregnancy | null;
  labs: Lab[];
  history: HistoryItem[];
  prescriptions: ApiRx[];
  visit: { visit_id: string; status: string } | null;
  draft: {
    chief_complaint: string;
    subjective: unknown;
    objective: unknown;
    assessment: unknown;
    plan: unknown;
  };
}

const EMPTY = {
  ly_do: "", benh_su: "", chan_doan: "", loi_dan: "",
  mach: "", nhiet_do: "", huyet_ap: "", nhip_tho: "", spo2: "",
  can_nang: "", chieu_cao: "", bmi: "",
  tuoi_thai: "", du_kien_sinh: "", chieu_cao_tc: "", nhip_tim_thai: "",
};
type Fields = typeof EMPTY;

// Tiền sử (III/IV) — bác sĩ sửa, lưu patient_medical_profile.
const EMPTY_PM = {
  allergies: "", blood_type: "", chronic: "", surgical: "",
  medications: "", family: "", notes: "",
};
type PmFields = typeof EMPTY_PM;

// Đơn thuốc (mục IX) — free-text, mỗi dòng 1 thuốc (chưa có drug master).
interface RxRow {
  drug_name: string;
  quantity: string;
  dosage: string;
  caution: string;
}
const EMPTY_RX: RxRow = { drug_name: "", quantity: "", dosage: "", caution: "" };
const BLOOD_TYPES = ["", "A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const splitComma = (s: string): string[] =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

const objOf = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" ? (x as Record<string, unknown>) : {};
const str = (x: unknown): string => (x == null ? "" : String(x));
const arr = (x: string[] | null | undefined) => (x && x.length ? x.join(", ") : "");
const famText = (x: unknown) => (!x ? "" : typeof x === "string" ? x : JSON.stringify(x));

// Tên xét nghiệm nguồn đôi khi kèm link Notion dài "(https://…)" → cắt bỏ cho gọn
// (feedback C6 — link tràn cột, hiển thị lỗi).
const cleanTestName = (s: string): string => {
  const out = (s ?? "").replace(/\s*\(https?:\/\/[^)]*\)?/gi, "").trim();
  return out || (s ?? "");
};

// Huyết áp dạng "tâm thu/tâm trương" (vd 120/80). null = hợp lệ; chuỗi = cảnh báo.
function bloodPressureWarn(v: string): string | null {
  const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(v);
  if (!m) return "Định dạng: tâm thu/tâm trương, vd 120/80";
  const s = Number(m[1]);
  const d = Number(m[2]);
  if (s < 60 || s > 260 || d < 30 || d > 160 || d >= s)
    return "Huyết áp bất thường (tâm thu 60–260 > tâm trương 30–160)";
  return null;
}

function readDraft(d: Data["draft"]): Fields {
  const o = objOf(d.objective);
  const v = objOf(o.vitals);
  const k = objOf(o.kham_thai);
  const s = objOf(d.subjective);
  const a = objOf(d.assessment);
  const p = objOf(d.plan);
  return {
    ly_do: str(d.chief_complaint),
    benh_su: str(s.benh_su),
    chan_doan: str(a.chan_doan),
    loi_dan: str(p.loi_dan),
    mach: str(v.mach), nhiet_do: str(v.nhiet_do), huyet_ap: str(v.huyet_ap),
    nhip_tho: str(v.nhip_tho), spo2: str(v.spo2), can_nang: str(v.can_nang),
    chieu_cao: str(v.chieu_cao), bmi: str(v.bmi),
    tuoi_thai: str(k.tuoi_thai), du_kien_sinh: str(k.du_kien_sinh),
    chieu_cao_tc: str(k.chieu_cao_tc), nhip_tim_thai: str(k.nhip_tim_thai),
  };
}

function AdminRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-24 shrink-0 text-[#888888]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[#171717]">{value || "—"}</dd>
    </div>
  );
}

function Section({ no, title, synced, editorLabel = "bác sĩ điền", children }: {
  no: string; title: string; synced?: boolean; editorLabel?: string; children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#f4f4f5] pt-3">
      <h4 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#171717]">
        <span>{no && <span className="text-[#ec4899]">{no}.</span>} {title}</span>
        <span className={
          "rounded px-1.5 py-0.5 text-[10px] font-medium " +
          (synced ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef9c3] text-[#a16207]")
        }>
          {synced ? "đồng bộ" : editorLabel}
        </span>
      </h4>
      {children}
    </section>
  );
}

export default function ClinicalRecordForm({
  appt,
  onClose,
  vitalsOnly = false,
  fill = false,
  readOnly = false,
  canEditAdmin = false,
}: {
  appt: DoctorApptRow;
  staffId: string | null;
  onClose: () => void;
  /** vitalsOnly = đón-khám (ĐD/Lễ tân/QL): CHỈ sửa Sinh hiệu, mọi mục khác xem. */
  vitalsOnly?: boolean;
  /** Lấp đầy CHIỀU CAO của khung cha (md+) — dùng khi đặt trong SplitPane. */
  fill?: boolean;
  /** readOnly = LỄ TÂN xem hồ sơ trong "Công việc của tôi": khóa MỌI ô +
   *  ẩn nút Lưu / Chỉ định XN / Thêm thuốc. Chỉ xem, không ghi. */
  readOnly?: boolean;
  /** canEditAdmin = cho SỬA mục I Hành chính (PATCH /api/patients) — độc lập với
   *  readOnly (Lễ tân chỉ-đọc lâm sàng nhưng vẫn sửa được hành chính). */
  canEditAdmin?: boolean;
}) {
  const router = useRouter();
  const p = appt.patient;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState<Fields>(EMPTY);
  const [pm, setPm] = useState<PmFields>(EMPTY_PM);
  const [rx, setRx] = useState<RxRow[]>([]);
  const [labOrder, setLabOrder] = useState("");
  const [labBusy, setLabBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!p?.clinic_patient_id) return;
    let on = true;
    fetch(`/api/clinical-record?patientId=${p.clinic_patient_id}&appointmentId=${appt.id}`)
      .then((r) => r.json())
      .then((d: Data) => {
        if (!on) return;
        setData(d);
        setF(readDraft(d.draft));
        const pr = d.profile;
        setPm(
          pr
            ? {
                allergies: arr(pr.allergies),
                blood_type: pr.blood_type ?? "",
                chronic: arr(pr.chronic_diseases),
                surgical: arr(pr.surgical_history),
                medications: arr(pr.current_medications),
                family: famText(pr.family_history),
                notes: pr.notes ?? "",
              }
            : EMPTY_PM,
        );
        setRx(
          (d.prescriptions ?? []).map((p) => ({
            drug_name: p.drug_name_raw ?? "",
            quantity: p.quantity ?? "",
            dosage: p.dosage_instructions ?? "",
            caution: p.caution ?? "",
          })),
        );
      })
      .catch(() => on && setData(null))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [p?.clinic_patient_id, appt.id]);

  const set = (k: keyof Fields, v: string) => setF((s) => ({ ...s, [k]: v }));
  const setP = (k: keyof PmFields, v: string) => setPm((s) => ({ ...s, [k]: v }));
  const setRxAt = (i: number, k: keyof RxRow, v: string) =>
    setRx((s) => s.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const addRx = () => setRx((s) => [...s, { ...EMPTY_RX }]);
  const removeRx = (i: number) => setRx((s) => s.filter((_, j) => j !== i));

  const locked = data?.visit?.status === "FINALIZED";

  // GATE LỄ TÂN: bác sĩ CHỈ điền được khi lễ tân đã check-in (bệnh nhân đã đến).
  // Không áp cho luồng đón-khám (vitalsOnly) — đó CHÍNH là lúc lễ tân check-in
  // + ghi sinh hiệu. (COMPLETED vẫn cho xem/sửa nháp khi visit chưa FINALIZED.)
  const arrivalPending =
    !vitalsOnly && appt.status !== "CHECKED_IN" && appt.status !== "COMPLETED";

  // Đủ điều kiện TỰ ĐỘNG "Khám xong": đang đã-đến + đã điền Chuẩn đoán + Lời dặn.
  const willComplete =
    !vitalsOnly &&
    appt.status === "CHECKED_IN" &&
    f.chan_doan.trim() !== "" &&
    f.loi_dan.trim() !== "";

  // Sinh hiệu (Sinh hiệu) gói riêng để dùng cho cả 2 luồng lưu.
  const vitalsPayload = () => ({
    mach: f.mach,
    nhiet_do: f.nhiet_do,
    huyet_ap: f.huyet_ap,
    nhip_tho: f.nhip_tho,
    spo2: f.spo2,
    can_nang: f.can_nang,
    chieu_cao: f.chieu_cao,
    bmi: f.bmi,
  });

  // Điều dưỡng: chỉ ghi Sinh hiệu (merge vào objective, KHÔNG đụng mục khác).
  async function saveVitals() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/clinical-record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        clinicPatientId: p?.clinic_patient_id,
        vitalsOnly: true,
        objective: { vitals: vitalsPayload() },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg((await res.json()).error ?? "Lỗi lưu sinh hiệu.");
      return;
    }
    setMsg("Đã lưu sinh hiệu.");
    router.refresh();
  }

  async function save() {
    if (readOnly) return; // Lễ tân chỉ-đọc: chặn ghi ngay tầng UI (server cũng chặn).
    if (vitalsOnly) return saveVitals();
    // Chưa tải xong / tải LỖI (data=null) → KHÔNG lưu: form còn rỗng sẽ ghi đè
    // xoá đơn thuốc + tiền sử + chẩn đoán cũ của lượt khám (backend thay toàn bộ).
    if (loading || !data) {
      setMsg("Chưa tải xong hồ sơ — đợi/tải lại rồi lưu (tránh mất dữ liệu cũ).");
      return;
    }
    if (arrivalPending) {
      setMsg("Chờ lễ tân xác nhận bệnh nhân đã đến (check-in) trước khi khám.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/clinical-record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        clinicPatientId: p?.clinic_patient_id,
        chief_complaint: f.ly_do,
        subjective: { benh_su: f.benh_su },
        objective: {
          vitals: {
            mach: f.mach, nhiet_do: f.nhiet_do, huyet_ap: f.huyet_ap,
            nhip_tho: f.nhip_tho, spo2: f.spo2, can_nang: f.can_nang,
            chieu_cao: f.chieu_cao, bmi: f.bmi,
          },
          kham_thai: {
            tuoi_thai: f.tuoi_thai, du_kien_sinh: f.du_kien_sinh,
            chieu_cao_tc: f.chieu_cao_tc, nhip_tim_thai: f.nhip_tim_thai,
          },
        },
        assessment: { chan_doan: f.chan_doan },
        plan: { loi_dan: f.loi_dan },
        profile: {
          allergies: splitComma(pm.allergies),
          blood_type: pm.blood_type || null,
          chronic_diseases: splitComma(pm.chronic),
          surgical_history: splitComma(pm.surgical),
          current_medications: splitComma(pm.medications),
          family_history: pm.family || null,
          notes: pm.notes || null,
        },
        prescriptions: rx,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      setMsg((await res.json()).error ?? "Lỗi lưu hồ sơ.");
      return;
    }
    // Điền ĐỦ (Chuẩn đoán VII + Lời dặn VIII) + BN đã đến → TỰ ĐỘNG chuyển lịch
    // sang "Đã khám xong" (COMPLETED). Không đụng FINALIZE (khóa pháp lý riêng).
    if (willComplete) {
      const done = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appt.id, action: "complete" }),
      });
      setSaving(false);
      setMsg(
        done.ok
          ? "Đã lưu hồ sơ & chuyển bệnh nhân sang Đã khám xong."
          : "Đã lưu hồ sơ. (Chưa tự chuyển Khám xong — hãy tải lại.)",
      );
    } else {
      setSaving(false);
      setMsg(
        "Đã lưu nháp. Điền đủ Chuẩn đoán + Lời dặn sẽ tự chuyển Đã khám xong.",
      );
    }
    router.refresh();
  }

  // Bác sĩ chỉ định 1 XN mới (PENDING) → ĐD nhập kết quả ở "Hàng đợi xét nghiệm".
  async function orderLab() {
    const name = labOrder.trim();
    if (!name) return;
    setLabBusy(true);
    const res = await fetch("/api/lab-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicPatientId: p?.clinic_patient_id,
        appointmentId: appt.id,
        test_name: name,
      }),
    });
    setLabBusy(false);
    if (!res.ok) {
      setMsg((await res.json()).error ?? "Lỗi chỉ định XN.");
      return;
    }
    // Hiện ngay trong mục VI (đang chờ kết quả).
    setData((d) =>
      d
        ? {
            ...d,
            labs: [
              {
                test_name: name,
                result_value: null,
                result_numeric: null,
                result_unit: null,
                flag: null,
                external_ref: null,
              },
              ...d.labs,
            ],
          }
        : d,
    );
    setLabOrder("");
    setMsg("Đã chỉ định XN — điều dưỡng nhập kết quả ở Hàng đợi xét nghiệm.");
  }

  const preg = data?.pregnancy;
  const labs = data?.labs ?? [];
  // khoá khi: LỄ TÂN chỉ-đọc / hồ sơ đã chốt / đang lưu / (bác sĩ) BN chưa check-in
  // / đang tải prefill (chưa tải xong mà sửa+lưu sẽ ghi đè rỗng — xem guard save()).
  const ro = readOnly || locked || saving || arrivalPending || loading;
  const roRest = ro || vitalsOnly; // đón-khám (vitalsOnly): mọi mục khác chỉ xem

  return (
    <div
      className={
        "flex flex-col rounded-xl border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] " +
        (fill
          ? "max-h-[calc(100vh-2rem)] md:max-h-none md:h-full"
          : "max-h-[calc(100vh-2rem)]")
      }
    >
      <div className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase text-[#171717]">
            Tóm tắt khám bệnh
            {vitalsOnly && (
              <span className="ml-2 rounded bg-[#fef9c3] px-1.5 py-0.5 text-[10px] font-medium normal-case text-[#a16207]">
                Chỉ ghi Sinh hiệu
              </span>
            )}
          </h3>
          <p className="text-xs text-[#888888]">
            {p?.full_name} · {p?.patient_code}
            {appt.service?.name ? ` · ${appt.service.name}` : ""} ·{" "}
            {fmtDateTimeOrDate(appt.slot_start)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="rounded-md p-1 text-[#71717a] hover:bg-[#f4f4f5]">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {readOnly && (
          <p className="rounded-md bg-[#fce7f3] px-3 py-1.5 text-xs text-[#9d2463]">
            👁 Chế độ chỉ xem — Lễ tân không chỉnh sửa hồ sơ.
          </p>
        )}
        {locked && (
          <p className="rounded-md bg-[#fee2e2] px-3 py-1.5 text-xs text-[#dc2626]">
            🔒 Hồ sơ đã chốt (FINALIZED) — luật cấm sửa, chỉ xem.
          </p>
        )}
        {arrivalPending && !readOnly && (
          <p className="rounded-md bg-[#fef9c3] px-3 py-1.5 text-xs text-[#a16207]">
            🕓 Chờ lễ tân xác nhận bệnh nhân đã đến (check-in) — chưa khám được.
          </p>
        )}

        <Section
          no="I"
          title="Hành chính"
          synced={!canEditAdmin}
          editorLabel="có thể sửa"
        >
          {canEditAdmin && p ? (
            <PatientAdminEditor
              patient={{
                clinic_patient_id: p.clinic_patient_id,
                full_name: p.full_name,
                date_of_birth: p.date_of_birth,
                phone_primary: p.phone_primary,
                phone_secondary: p.phone_secondary,
                gender: p.gender,
                ethnicity: p.ethnicity,
                nationality: p.nationality,
                occupation: p.occupation,
                patient_objection: p.patient_objection,
                address: p.address,
                guardian_name: p.guardian_name,
              }}
            />
          ) : (
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <AdminRow label="Họ tên" value={p?.full_name} />
              <AdminRow label="Ngày sinh" value={p?.date_of_birth ? fmtDate(p.date_of_birth) : null} />
              <AdminRow label="Giới tính" value={p?.gender} />
              <AdminRow label="Dân tộc" value={p?.ethnicity} />
              <AdminRow label="Quốc tịch" value={p?.nationality} />
              <AdminRow label="Nghề nghiệp" value={p?.occupation} />
              <AdminRow label="Đối tượng" value={p?.patient_objection} />
              <AdminRow label="SĐT" value={p?.phone_primary} />
              <AdminRow label="Địa chỉ" value={p?.address} />
            </dl>
          )}
        </Section>

        {(data?.history?.length ?? 0) > 0 && (
          <details className="border-t border-[#f4f4f5] pt-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-[#171717]">
              Lịch sử khám trước ({data!.history.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {data!.history.map((h) => (
                <li
                  key={h.visit_id}
                  className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium text-[#171717]">
                      {fmtDate(h.created_at)}
                    </span>
                    <span className="text-xs text-[#888888]">
                      {[h.service, h.doctor].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  {h.chief_complaint && (
                    <p className="mt-1 line-clamp-3 text-[#52525b]">
                      <span className="text-[#888888]">Lý do: </span>
                      {h.chief_complaint}
                    </p>
                  )}
                  {h.assessment && (
                    <p className="mt-0.5 line-clamp-2 text-[#52525b]">
                      <span className="text-[#888888]">Chuẩn đoán: </span>
                      {h.assessment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Section no="" title="Sinh hiệu" editorLabel="lễ tân/điều dưỡng điền">
          <div className="grid grid-cols-2 gap-2">
            {/* Ô SỐ bắt buộc số + NGƯỠNG hợp lý (tránh gõ thừa số: 37→377). Huyết
                áp là CHỮ vì dạng "120/80". [key, nhãn, type, step, min, max] */}
            {([
              ["mach", "Mạch (l/p)", "number", "1", 20, 250],
              ["nhiet_do", "Nhiệt độ (°C)", "number", "0.1", 30, 45],
              ["huyet_ap", "Huyết áp", "text", undefined, 0, 0],
              ["nhip_tho", "Nhịp thở (l/p)", "number", "1", 5, 80],
              ["spo2", "SpO2 (%)", "number", "1", 50, 100],
              ["can_nang", "Cân nặng (kg)", "number", "0.1", 1, 300],
              ["chieu_cao", "Chiều cao (cm)", "number", "0.1", 20, 250],
              ["bmi", "BMI", "number", "0.1", 5, 80],
            ] as [keyof Fields, string, string, string | undefined, number, number][]).map(
              ([k, lbl, ty, st, lo, hi]) => {
                // Cảnh báo: ô số → ngoài ngưỡng; Huyết áp → sai định dạng/bất thường.
                let warn: string | null = null;
                const v = f[k].trim();
                if (v !== "") {
                  if (k === "huyet_ap") warn = bloodPressureWarn(v);
                  else if (ty === "number") {
                    const n = Number(v);
                    if (!Number.isFinite(n)) warn = "Phải là số";
                    else if (n < lo || n > hi) warn = `Nên trong ${lo}–${hi}`;
                  }
                }
                return (
                  <div key={k}>
                    <label className={LABEL}>{lbl}</label>
                    <input
                      type={ty}
                      step={ty === "number" ? st : undefined}
                      inputMode={ty === "number" ? "decimal" : undefined}
                      min={ty === "number" ? lo : undefined}
                      max={ty === "number" ? hi : undefined}
                      placeholder={k === "huyet_ap" ? "vd 120/80" : undefined}
                      className={INPUT + (warn ? " border-[#dc2626]" : "")}
                      value={f[k]}
                      disabled={ro}
                      onChange={(e) => set(k, e.target.value)}
                    />
                    {warn && (
                      <p className="mt-0.5 text-[11px] text-[#dc2626]">{warn}</p>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </Section>

        <Section no="II" title="Lý do vào khám">
          <input className={INPUT} value={f.ly_do} disabled={roRest} onChange={(e) => set("ly_do", e.target.value)} placeholder="VD: Khám thai" />
        </Section>

        <Section no="III" title="Tiền sử dị ứng">
          <input
            className={INPUT}
            value={pm.allergies}
            disabled={roRest}
            onChange={(e) => setP("allergies", e.target.value)}
            placeholder="Cách nhau dấu phẩy, vd: Penicillin, Hải sản"
          />
        </Section>

        <Section no="IV" title="Tiền sử (mạn tính / PT / thuốc / gia đình)">
          <div className="space-y-2">
            <div>
              <label className={LABEL}>Nhóm máu</label>
              <select className={INPUT} value={pm.blood_type} disabled={roRest} onChange={(e) => setP("blood_type", e.target.value)}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>{b || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Bệnh mạn tính</label>
              <input className={INPUT} value={pm.chronic} disabled={roRest} onChange={(e) => setP("chronic", e.target.value)} placeholder="Cách nhau dấu phẩy" />
            </div>
            <div>
              <label className={LABEL}>Tiền sử phẫu thuật</label>
              <input className={INPUT} value={pm.surgical} disabled={roRest} onChange={(e) => setP("surgical", e.target.value)} placeholder="Cách nhau dấu phẩy" />
            </div>
            <div>
              <label className={LABEL}>Thuốc đang dùng</label>
              <input className={INPUT} value={pm.medications} disabled={roRest} onChange={(e) => setP("medications", e.target.value)} placeholder="Cách nhau dấu phẩy" />
            </div>
            <div>
              <label className={LABEL}>Tiền sử gia đình</label>
              <input className={INPUT} value={pm.family} disabled={roRest} onChange={(e) => setP("family", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Ghi chú tiền sử</label>
              <textarea className={INPUT} rows={2} value={pm.notes} disabled={roRest} onChange={(e) => setP("notes", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section no="V" title="Bệnh sử & khám thai">
          <textarea className={INPUT} rows={2} value={f.benh_su} disabled={roRest} onChange={(e) => set("benh_su", e.target.value)} placeholder="Quá trình bệnh lý…" />
          {!loading && preg && (
            <dl className="mt-2 space-y-1.5">
              <AdminRow label="Dự kiến sinh (HS)" value={preg.edd_date ? fmtDate(preg.edd_date) : null} />
              <AdminRow label="Tuổi thai (ĐK)" value={preg.gestational_age_at_registration != null ? `${preg.gestational_age_at_registration} tuần` : null} />
              <AdminRow label="Nguy cơ cao" value={preg.is_high_risk ? `Có${preg.high_risk_reason ? " — " + preg.high_risk_reason : ""}` : "Không"} />
            </dl>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* Dự kiến sinh = ngày; Tuổi thai/Cao TC/Tim thai = SỐ (bắt buộc số). */}
            {([
              ["tuoi_thai", "Tuổi thai (tuần)", 1, 45],
              ["du_kien_sinh", "Dự kiến sinh", 0, 0],
              ["chieu_cao_tc", "Cao TC/VB (cm)", 1, 60],
              ["nhip_tim_thai", "Tim thai (l/p)", 60, 220],
            ] as [keyof Fields, string, number, number][]).map(([k, lbl, lo, hi]) => {
              const ty = k === "du_kien_sinh" ? "date" : "number";
              const n = ty === "number" && f[k].trim() !== "" ? Number(f[k]) : null;
              const oor = n != null && Number.isFinite(n) && (n < lo || n > hi);
              return (
                <div key={k}>
                  <label className={LABEL}>{lbl}</label>
                  <input
                    type={ty}
                    step={ty === "number" ? (k === "chieu_cao_tc" ? "0.1" : "1") : undefined}
                    inputMode={ty === "number" ? "decimal" : undefined}
                    min={ty === "number" ? lo : undefined}
                    max={ty === "number" ? hi : undefined}
                    className={INPUT + (oor ? " border-[#dc2626]" : "")}
                    value={f[k]}
                    disabled={roRest}
                    onChange={(e) => set(k, e.target.value)}
                  />
                  {oor && (
                    <p className="mt-0.5 text-[11px] text-[#dc2626]">
                      Nên trong {lo}–{hi}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section no="VI" title="Kết quả cận lâm sàng" synced>
          {loading ? (
            <Loading />
          ) : labs.length === 0 ? (
            <p className="text-sm text-[#a1a1aa]">— chưa chỉ định / chưa có kết quả —</p>
          ) : (
            <ul className="divide-y divide-[#f4f4f5] rounded-lg border border-[#e4e4e7]">
              {labs.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-[#171717]">{cleanTestName(l.test_name)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">
                      {l.result_value ?? l.result_numeric ?? (l.external_ref ? "có phiếu" : "chờ KQ")}
                      {l.result_unit ? ` ${l.result_unit}` : ""}
                    </span>
                    {l.external_ref && (
                      <a
                        href={l.external_ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#2563eb] hover:underline"
                      >
                        Phiếu
                      </a>
                    )}
                    {l.flag && l.flag !== "NORMAL" && (
                      <span className="rounded bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-medium text-[#dc2626]">{l.flag}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!vitalsOnly && !readOnly && (
            <div className="mt-2 flex items-center gap-2">
              <input
                className={INPUT}
                value={labOrder}
                disabled={roRest}
                onChange={(e) => setLabOrder(e.target.value)}
                placeholder="Chỉ định XN mới (vd: NIPT, Tổng phân tích nước tiểu…)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    orderLab();
                  }
                }}
              />
              <button
                onClick={orderLab}
                disabled={roRest || labBusy || !labOrder.trim()}
                className="shrink-0 rounded-lg border border-[#f3cfe0] px-3 py-2 text-sm font-medium text-[#9d2463] hover:bg-[#fdf2f8] disabled:opacity-50"
              >
                {labBusy ? "..." : "Chỉ định"}
              </button>
            </div>
          )}
        </Section>

        <Section no="VII" title="Chuẩn đoán">
          <textarea className={INPUT} rows={2} value={f.chan_doan} disabled={roRest} onChange={(e) => set("chan_doan", e.target.value)} placeholder="VD: Z34 - Theo dõi thai…" />
        </Section>

        <Section no="VIII" title="Hướng xử lý & lời dặn">
          <textarea className={INPUT} rows={3} value={f.loi_dan} disabled={roRest} onChange={(e) => set("loi_dan", e.target.value)} />
        </Section>

        {!vitalsOnly && (
          <Section no="IX" title="Đơn thuốc">
            <div className="space-y-2">
              {rx.length === 0 && (
                <p className="text-sm text-[#a1a1aa]">— chưa kê thuốc —</p>
              )}
              {rx.map((row, i) => (
                <div key={i} className="rounded-lg border border-[#e4e4e7] p-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={INPUT}
                      placeholder="Tên thuốc"
                      value={row.drug_name}
                      disabled={roRest}
                      onChange={(e) => setRxAt(i, "drug_name", e.target.value)}
                    />
                    {!roRest && (
                      <button
                        onClick={() => removeRx(i)}
                        aria-label="Xoá thuốc"
                        className="shrink-0 rounded-md p-1.5 text-[#dc2626] hover:bg-[#fef2f2]"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      className={INPUT}
                      placeholder="Số lượng (vd: 30 viên)"
                      value={row.quantity}
                      disabled={roRest}
                      onChange={(e) => setRxAt(i, "quantity", e.target.value)}
                    />
                    <input
                      className={INPUT}
                      placeholder="Cách dùng (vd: 2v/ngày sau ăn)"
                      value={row.dosage}
                      disabled={roRest}
                      onChange={(e) => setRxAt(i, "dosage", e.target.value)}
                    />
                    <input
                      className={INPUT}
                      placeholder="Lưu ý"
                      value={row.caution}
                      disabled={roRest}
                      onChange={(e) => setRxAt(i, "caution", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              {!roRest && (
                <button
                  onClick={addRx}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#f3cfe0] px-3 py-1.5 text-sm font-medium text-[#9d2463] hover:bg-[#fdf2f8]"
                >
                  <Plus size={14} /> Thêm thuốc
                </button>
              )}
            </div>
          </Section>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#e4e4e7] px-4 py-3">
        <span
          className={
            "text-xs " +
            (readOnly
              ? "text-[#9d2463]"
              : msg?.startsWith("Đã lưu")
                ? "text-[#15803d]"
                : "text-[#dc2626]")
          }
        >
          {readOnly ? "👁 Chỉ xem — không có quyền sửa." : (msg ?? "")}
        </span>
        <div className="flex gap-2">
          {/* Lễ tân chỉ-đọc: ẨN nút Lưu hoàn toàn (không chỉ disable). */}
          {!readOnly && (
            <button
              onClick={save}
              disabled={ro}
              className="min-h-10 rounded-lg bg-[#ec4899] px-4 text-sm font-semibold text-white hover:bg-[#db2777] disabled:opacity-50"
            >
              {saving
                ? "Đang lưu…"
                : vitalsOnly
                  ? "Lưu sinh hiệu"
                  : willComplete
                    ? "Lưu & Khám xong"
                    : "Lưu hồ sơ"}
            </button>
          )}
          <button onClick={onClose} className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5]">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return <p className="text-sm text-[#a1a1aa]">Đang tải…</p>;
}
