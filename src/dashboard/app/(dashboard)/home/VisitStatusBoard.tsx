// Bảng "Trạng thái BN buổi khám" — READ-ONLY cho Lễ tân (front desk).
// List BN có buổi khám (visit) TẠO HÔM NAY, cột trạng thái theo enum visit.status
// (OPEN / IN_PROGRESS / FINALIZED / AMENDED — nguồn: migration 017_create_clinical_domain).
// CHỈ hiển thị, không nút ghi. Data server-fetch ở home/page.tsx, đọc thẳng Supabase
// (RLS SELECT visit_select_authenticated). Badge riêng cho visit — KHÔNG dùng StatusBadge
// (badge đó dành cho appointment.status, màu khác).

import { fmtTime } from "../../../lib/datetime";

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
  "border-b border-[#ececec] px-3 py-2 text-left font-semibold text-[#525252]";
const TD = "border-b border-[#f3f3f3] px-3 py-2 align-middle text-[#171717]";

export default function VisitStatusBoard({ rows }: { rows: VisitStatusRow[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-[#ececec] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="bg-[#fafafa]">
          <tr>
            <th className={TH}>Giờ vào</th>
            <th className={TH}>Bệnh nhân</th>
            <th className={TH}>Bác sĩ khám</th>
            <th className={TH}>Dịch vụ</th>
            <th className={TH}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-[#888888]" colSpan={5}>
                Chưa có buổi khám nào hôm nay.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.visit_id} className="hover:bg-[#fafafa]">
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {fmtTime(r.checked_in_at ?? r.created_at)}
                </td>
                <td className={TD}>
                  <span className="font-medium">
                    {r.patient?.full_name ?? "—"}
                  </span>
                  {r.patient?.patient_code && (
                    <span className="ml-1.5 text-xs text-[#888888]">
                      {r.patient.patient_code}
                    </span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.doctor?.full_name ?? <span className="text-[#bbbbbb]">—</span>}
                </td>
                <td className={TD}>
                  {r.service?.name ?? <span className="text-[#bbbbbb]">—</span>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <VisitBadge status={r.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
