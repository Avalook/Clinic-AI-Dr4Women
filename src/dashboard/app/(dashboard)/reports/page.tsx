// Reports placeholder (admin-only via the Nav). Phase 1 demo doesn't
// ship analytics — clinic still pulls reports from Notion. The route
// exists so the nav entry is not a 404 + so future report widgets have
// a home.

import { redirect } from "next/navigation";
import { getClinicRole } from "../../../lib/clinic-session";
import { isAdminRole } from "../../../lib/roles";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Defense-in-depth: server-side gate even though Nav only renders the
  // link for admins.
  const role = await getClinicRole();
  if (!isAdminRole(role)) redirect("/home");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Báo cáo</h1>
        <p className="text-sm text-[#888888]">
          Báo cáo vận hành dashboard. Phase 1 demo chưa có nội dung — đang
          phát triển.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-[#e4e4e7] bg-white px-6 py-12 text-center text-sm text-[#888888]">
        <p className="mb-1 text-base text-[#4d4d4d]">🚧 Đang phát triển</p>
        <p>
          Kế hoạch: BN theo ngày, lịch hẹn theo bác sĩ, tỉ lệ no-show, doanh
          thu dịch vụ. Sẽ làm sau khi PM duyệt KPI cần track.
        </p>
      </div>
    </div>
  );
}
