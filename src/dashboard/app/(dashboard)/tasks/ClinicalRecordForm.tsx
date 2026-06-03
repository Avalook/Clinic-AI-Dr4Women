"use client";

// Hồ sơ lâm sàng (TÓM TẮT KHÁM BỆNH) — layout theo mẫu phòng khám gửi.
//   I. Hành chính        → ĐỒNG BỘ từ `patient` (read-only).
//   III/IV Tiền sử       → ĐỒNG BỘ từ `patient_medical_profile` (read-only).
//   V. Thai kỳ           → ĐỒNG BỘ từ `pregnancy` (read-only).
//   VI. Cận lâm sàng     → ĐỒNG BỘ từ `lab_result` máy XN (read-only).
//   Sinh hiệu, II, VII, VIII → BÁC SĨ điền khi khám (placeholder).
// LƯU hồ sơ = Tầng 2 (chưa wiring): visit FINALIZED bị DB khóa sửa
// (TT13/2011/TT-BYT), lab GROUP_C cần duyệt — KHÔNG tự vượt gate.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fmtDate, fmtDateTimeOrDate } from "../../../lib/datetime";
import { INPUT, LABEL } from "../form-ui";
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
  outcome: string | null;
}
interface Lab {
  test_name: string;
  result_value: string | null;
  result_numeric: number | null;
  result_unit: string | null;
  flag: string | null;
  triage_group: string | null;
  result_received_at: string | null;
}
interface Data {
  profile: Profile | null;
  pregnancy: Pregnancy | null;
  labs: Lab[];
}

const arr = (x: string[] | null | undefined) =>
  x && x.length ? x.join(", ") : "";
const famText = (x: unknown) =>
  !x ? "" : typeof x === "string" ? x : JSON.stringify(x);

function AdminRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-28 shrink-0 text-[#888888]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[#171717]">
        {value || "—"}
      </dd>
    </div>
  );
}

function Section({
  no,
  title,
  synced,
  children,
}: {
  no: string;
  title: string;
  synced?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#f4f4f5] pt-3">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#171717]">
        <span>
          {no && <span className="text-[#ec4899]">{no}.</span>} {title}
        </span>
        {synced ? (
          <span className="rounded bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-medium text-[#15803d]">
            đồng bộ
          </span>
        ) : (
          <span className="rounded bg-[#fef9c3] px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]">
            bác sĩ điền
          </span>
        )}
      </h4>
      {children}
    </section>
  );
}

function ReadText({ value }: { value: string }) {
  return value ? (
    <p className="whitespace-pre-wrap text-sm text-[#171717]">{value}</p>
  ) : (
    <p className="text-sm text-[#a1a1aa]">— chưa có —</p>
  );
}

export default function ClinicalRecordForm({
  appt,
  onClose,
}: {
  appt: DoctorApptRow;
  staffId: string | null;
  onClose: () => void;
}) {
  const p = appt.patient;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!p?.clinic_patient_id) return;
    // Form được remount theo BN (key ở DoctorWorkBoard) → loading khởi tạo = true,
    // không cần setLoading(true) đồng bộ ở đây.
    let on = true;
    fetch(`/api/clinical-record?patientId=${p.clinic_patient_id}`)
      .then((r) => r.json())
      .then((d) => on && setData(d as Data))
      .catch(() => on && setData(null))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [p?.clinic_patient_id]);

  const prof = data?.profile;
  const preg = data?.pregnancy;
  const labs = data?.labs ?? [];

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e4e4e7] bg-white px-5 py-3">
        <div>
          <h3 className="text-base font-bold uppercase text-[#171717]">
            Tóm tắt khám bệnh
          </h3>
          <p className="text-xs text-[#888888]">
            Mã BN: {p?.patient_code ?? "—"} · Đến khám:{" "}
            {fmtDateTimeOrDate(appt.slot_start)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-md p-1 text-[#71717a] hover:bg-[#f4f4f5]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* I. Hành chính */}
        <Section no="I" title="Hành chính" synced>
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <AdminRow label="Họ tên" value={p?.full_name} />
            <AdminRow label="Ngày sinh" value={p?.date_of_birth ? fmtDate(p.date_of_birth) : null} />
            <AdminRow label="Giới tính" value={p?.gender} />
            <AdminRow label="Dân tộc" value={p?.ethnicity} />
            <AdminRow label="Quốc tịch" value={p?.nationality} />
            <AdminRow label="Nghề nghiệp" value={p?.occupation} />
            <AdminRow label="Đối tượng" value={p?.patient_objection} />
            <AdminRow label="SĐT" value={p?.phone_primary} />
            <AdminRow label="Người bảo lãnh" value={p?.guardian_name} />
            <AdminRow label="Địa chỉ" value={p?.address} />
          </dl>
        </Section>

        {/* Sinh hiệu — bác sĩ điền */}
        <Section no="" title="Sinh hiệu">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Mạch (l/p)", "Nhiệt độ (°C)", "Huyết áp", "Nhịp thở (l/p)", "SpO2 (%)", "Cân nặng (kg)", "Chiều cao (cm)", "BMI"].map((v) => (
              <div key={v}>
                <label className={LABEL}>{v}</label>
                <input className={INPUT} />
              </div>
            ))}
          </div>
        </Section>

        <Section no="II" title="Lý do vào khám">
          <input className={INPUT} placeholder="VD: Khám thai" />
        </Section>

        {/* III. Dị ứng — đồng bộ */}
        <Section no="III" title="Tiền sử dị ứng" synced>
          {loading ? <Loading /> : <ReadText value={arr(prof?.allergies)} />}
        </Section>

        {/* IV. Tiền sử — đồng bộ */}
        <Section no="IV" title="Tiền sử (mạn tính / phẫu thuật / thuốc / gia đình)" synced>
          {loading ? (
            <Loading />
          ) : (
            <dl className="space-y-1.5">
              <AdminRow label="Nhóm máu" value={prof?.blood_type} />
              <AdminRow label="Bệnh mạn tính" value={arr(prof?.chronic_diseases)} />
              <AdminRow label="Tiền sử PT" value={arr(prof?.surgical_history)} />
              <AdminRow label="Thuốc đang dùng" value={arr(prof?.current_medications)} />
              <AdminRow label="Gia đình" value={famText(prof?.family_history)} />
              <AdminRow label="Ghi chú" value={prof?.notes} />
            </dl>
          )}
        </Section>

        {/* V. Bệnh sử & thai kỳ */}
        <Section no="V" title="Bệnh sử & khám thai">
          <textarea className={INPUT} rows={2} placeholder="Quá trình bệnh lý… (bác sĩ điền)" />
          {loading ? (
            <Loading />
          ) : preg ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <AdminRow label="Dự kiến sinh" value={preg.edd_date ? fmtDate(preg.edd_date) : null} />
              <AdminRow label="Tuổi thai (ĐK)" value={preg.gestational_age_at_registration != null ? `${preg.gestational_age_at_registration} tuần` : null} />
              <AdminRow label="Thai nguy cơ cao" value={preg.is_high_risk ? `Có${preg.high_risk_reason ? " — " + preg.high_risk_reason : ""}` : "Không"} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[#a1a1aa]">— chưa có hồ sơ thai kỳ —</p>
          )}
        </Section>

        {/* VI. Cận lâm sàng — đồng bộ từ máy XN */}
        <Section no="VI" title="Kết quả cận lâm sàng" synced>
          {loading ? (
            <Loading />
          ) : labs.length === 0 ? (
            <p className="text-sm text-[#a1a1aa]">— chưa có kết quả —</p>
          ) : (
            <ul className="divide-y divide-[#f4f4f5] rounded-lg border border-[#e4e4e7]">
              {labs.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-[#171717]">{l.test_name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">
                      {l.result_value ?? l.result_numeric ?? "—"}
                      {l.result_unit ? ` ${l.result_unit}` : ""}
                    </span>
                    {l.flag && l.flag !== "NORMAL" && (
                      <span className="rounded bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-medium text-[#dc2626]">
                        {l.flag}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-[#a1a1aa]">
            Đồng bộ từ máy xét nghiệm — bác sĩ chỉ xem, không sửa kết quả.
          </p>
        </Section>

        <Section no="VII" title="Chẩn đoán">
          <textarea className={INPUT} rows={2} placeholder="VD: Z34 - Theo dõi thai…" />
        </Section>

        <Section no="VIII" title="Hướng xử lý & lời dặn">
          <textarea className={INPUT} rows={3} />
        </Section>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#e4e4e7] bg-white px-5 py-3">
        <span className="text-xs text-[#a1a1aa]">
          Lưu hồ sơ: đang hoàn thiện (tôn trọng quy định khóa hồ sơ đã chốt).
        </span>
        <div className="flex gap-2">
          <button
            disabled
            title="Sắp có — Tầng 2"
            className="min-h-10 cursor-not-allowed rounded-lg bg-[#ec4899]/50 px-4 text-sm font-semibold text-white"
          >
            Lưu hồ sơ
          </button>
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5]"
          >
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
