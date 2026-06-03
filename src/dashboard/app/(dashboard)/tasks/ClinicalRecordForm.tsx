"use client";

// Hồ sơ lâm sàng (TÓM TẮT KHÁM BỆNH) — layout theo mẫu phòng khám gửi. Mục I.
// Hành chính = ĐỒNG BỘ từ `patient` (read-only, CSKH/Lễ tân đã nhập). Sinh hiệu +
// mục II–VIII = BÁC SĨ điền. LƯU hồ sơ đang ở Tầng 2 (chưa wiring) vì phải tôn
// trọng safety-gate: visit FINALIZED bị DB khóa sửa (TT13/2011/TT-BYT), lab GROUP_C
// cần duyệt — không tự vượt. Turn này: nhập + xem layout.

import { X } from "lucide-react";
import { fmtDate, fmtDateTimeOrDate } from "../../../lib/datetime";
import { INPUT, LABEL } from "../form-ui";
import type { DoctorApptRow } from "./DoctorWorkBoard";

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
  children,
}: {
  no: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#f4f4f5] pt-3">
      <h4 className="mb-2 text-sm font-semibold text-[#171717]">
        <span className="text-[#ec4899]">{no}.</span> {title}
      </h4>
      {children}
    </section>
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

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      {/* Header */}
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
        <p className="rounded-md bg-[#eff6ff] px-3 py-1.5 text-xs text-[#1d4ed8]">
          Mục I (Hành chính) đồng bộ tự động từ hồ sơ khách hàng · phần còn lại bác
          sĩ điền.
        </p>

        {/* I. Hành chính (đồng bộ, read-only) */}
        <Section no="I" title="Hành chính (đồng bộ)">
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
            {[
              "Mạch (l/p)",
              "Nhiệt độ (°C)",
              "Huyết áp (mmHg)",
              "Nhịp thở (l/p)",
              "SpO2 (%)",
              "Cân nặng (kg)",
              "Chiều cao (cm)",
              "BMI",
            ].map((v) => (
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

        <Section no="III" title="Tiền sử dị ứng">
          <input className={INPUT} />
        </Section>

        <Section no="IV" title="Tiền sử (PARA, sản/phụ/nội khoa, gia đình)">
          <textarea className={INPUT} rows={3} />
        </Section>

        <Section no="V" title="Bệnh sử & khám thai">
          <textarea className={INPUT} rows={2} placeholder="Quá trình bệnh lý…" />
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Tuổi thai (tuần)</label>
              <input className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Dự kiến sinh</label>
              <input type="date" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Chiều cao TC/VB (cm)</label>
              <input className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Nhịp tim thai (l/p)</label>
              <input className={INPUT} />
            </div>
          </div>
        </Section>

        <Section no="VI" title="Kết quả cận lâm sàng">
          <p className="rounded-md bg-[#f4f4f5] px-3 py-2 text-xs text-[#71717a]">
            Công thức máu / sinh hóa / siêu âm — đồng bộ từ máy xét nghiệm
            (`lab_result`, `ultrasound_record`). Bác sĩ chỉ xem, không sửa kết quả.
          </p>
        </Section>

        <Section no="VII" title="Chẩn đoán">
          <textarea className={INPUT} rows={2} placeholder="VD: Z34 - Theo dõi thai…" />
        </Section>

        <Section no="VIII" title="Hướng xử lý & lời dặn">
          <textarea className={INPUT} rows={3} />
        </Section>
      </div>

      {/* Footer */}
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
