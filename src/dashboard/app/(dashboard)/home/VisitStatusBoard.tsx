// Bảng "Trạng thái BN buổi khám" — READ-ONLY cho Lễ tân (front desk).
// List BN có buổi khám (visit) TẠO HÔM NAY, cột trạng thái theo enum visit.status
// (OPEN / IN_PROGRESS / FINALIZED / AMENDED — nguồn: migration 017_create_clinical_domain).
// CHỈ hiển thị, không nút ghi. Data server-fetch ở home/page.tsx, đọc thẳng Supabase
// (RLS SELECT visit_select_authenticated). Badge riêng cho visit — KHÔNG dùng StatusBadge
// (badge đó dành cho appointment.status, màu khác).

import { fmtTime } from "../../../lib/datetime";
import { ProgressStepper, WaitClock } from "./VisitProgress";

// BN còn đang chờ / đang khám → đồng hồ chờ chạy. Đã FINALIZED/AMENDED → dừng.
const WAITING_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);

// Nhãn + màu cho visit.status (4 giá trị enum). Tông đồng bộ với StatusBadge.
const VISIT_STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-[#dbeafe] text-[#1d4ed8]",
  IN_PROGRESS: "bg-[#fef9c3] text-[#a16207]",
  FINALIZED: "bg-[#dcfce7] text-[#15803d]",
  AMENDED: "bg-[#f3e8ff] text-[#7e22ce]",
};
const VISIT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Chờ khám",
  IN_PROGRESS: "Đang khám",
  FINALIZED: "Đã khám xong",
  AMENDED: "Đã bổ sung",
};

function VisitBadge({ status }: { status: string }) {
  const style = VISIT_STATUS_STYLE[status] ?? "bg-[#f4f4f5] text-[#71717a]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {VISIT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export interface VisitStatusRow {
  visit_id: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  patient: { full_name: string | null; patient_code: string | null } | null;
  doctor: { full_name: string | null } | null;
  service: { name: string | null } | null;
}

const TH =
  "border-b border-[#ececec] px-4 py-2.5 text-left font-semibold text-[#525252]";
const TD = "border-b border-[#f3f3f3] px-4 py-3 align-middle text-[#171717]";

export default function VisitStatusBoard({ rows }: { rows: VisitStatusRow[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-[#ececec] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="bg-[#fafafa]">
          <tr>
            {/* Ô đầu: thông tin BN gộp. Còn lại: thanh tiến trình 3 mốc. */}
            <th className={`${TH} min-w-[240px]`}>Bệnh nhân</th>
            <th className={`${TH} min-w-[340px]`}>Tiến trình buổi khám</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-[#888888]" colSpan={2}>
                Chưa có buổi khám nào hôm nay.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.visit_id} className="hover:bg-[#fafafa]">
                {/* Ô 1 — thông tin gộp: tên BN + mã · bác sĩ · dịch vụ · trạng thái
                    (live badge) + đồng hồ chờ (đếm liên tục từ check-in). */}
                <td className={TD}>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold text-[#171717]">
                        {r.patient?.full_name ?? "—"}
                      </span>
                      {r.patient?.patient_code && (
                        <span className="font-mono text-xs text-[#888888]">
                          {r.patient.patient_code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#71717a]">
                      <span className="text-[#a1a1aa]">BS:</span>{" "}
                      {r.doctor?.full_name ?? "—"}
                      <span className="mx-1 text-[#d4d4d8]">·</span>
                      {r.service?.name ?? "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <VisitBadge status={r.status} />
                      <WaitClock
                        checkedInAt={r.checked_in_at}
                        active={WAITING_STATUSES.has(r.status)}
                      />
                      <span className="text-[10px] text-[#bcbcbc] tabular-nums">
                        vào {fmtTime(r.checked_in_at ?? r.created_at)}
                      </span>
                    </div>
                  </div>
                </td>
                {/* Ô 2 — thanh tiến trình kiểu Grab (Đang khám → Khám xong → Thanh toán). */}
                <td className={TD}>
                  <ProgressStepper status={r.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
