// Settings — Admin-only staff overview. The current Phase 1 demo need
// is for an operator to see which staff rows are linked to a Supabase
// Auth account (the green dot) so they can run
// ``scripts/seed/link_staff_to_auth.py`` for the missing ones.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getCurrentStaff, isAdminRole } from "../../../lib/current-staff";

export const dynamic = "force-dynamic";

interface StaffRow {
  id: string;
  full_name: string;
  short_name: string | null;
  primary_department: string;
  employment_type: string;
  is_active: boolean;
  auth_user_id: string | null;
}

// Friendly label per Supabase CHECK enum.
const DEPT_LABEL: Record<string, string> = {
  DOCTOR: "Bác sĩ",
  ULTRASOUND_DOCTOR: "Bác sĩ Siêu âm",
  NURSE_ULTRASOUND: "Điều dưỡng",
  RECEPTION: "Lễ tân",
  CSKH: "CSKH",
  MANAGEMENT: "Quản lý",
};

const TH = "px-4 py-2.5 font-medium";
const TD = "px-4 py-2.5";

export default async function SettingsPage() {
  const staff = await getCurrentStaff();
  if (!isAdminRole(staff)) redirect("/home");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, full_name, short_name, primary_department, employment_type, " +
        "is_active, auth_user_id",
    )
    .order("primary_department", { ascending: true })
    .order("full_name", { ascending: true });

  const rows = (data as StaffRow[] | null) ?? [];
  const linked = rows.filter((r) => r.auth_user_id !== null).length;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#171717]">Cài đặt</h1>
          <p className="text-sm text-[#888888]">
            Nhân viên + trạng thái liên kết tài khoản đăng nhập.
          </p>
        </div>
        <Link
          href="/settings/new-user"
          className="rounded-md bg-[#ec4899] px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777]"
        >
          + Thêm tài khoản
        </Link>
      </header>

      <div className="rounded-md border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#4d4d4d]">
        <span className="font-medium text-[#171717]">{linked}</span> /{" "}
        <span className="font-medium text-[#171717]">{rows.length}</span>{" "}
        nhân viên đã được link với tài khoản đăng nhập. Để link thêm, tạo
        user trong Supabase Auth rồi chạy{" "}
        <code className="rounded bg-[#f4f4f5] px-1.5 py-0.5 text-xs font-mono">
          scripts/seed/link_staff_to_auth.py --map &quot;Tên=uuid&quot;
        </code>
        .
      </div>

      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <table className="min-w-full divide-y divide-[#e4e4e7] text-sm">
          <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className={TH}>Họ tên</th>
              <th className={TH}>Vai trò</th>
              <th className={TH}>Hợp đồng</th>
              <th className={TH}>Active</th>
              <th className={TH}>Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f4f5]">
            {rows.map((r) => (
              <tr
                key={r.id}
                className="transition-colors duration-150 hover:bg-[#f9fafb]"
              >
                <td className={`${TD} text-[#171717]`}>
                  {r.full_name}
                  {r.short_name && r.short_name !== r.full_name && (
                    <span className="ml-2 text-xs text-[#888888]">
                      {r.short_name}
                    </span>
                  )}
                </td>
                <td className={`${TD} text-[#4d4d4d]`}>
                  {DEPT_LABEL[r.primary_department] ?? r.primary_department}
                </td>
                <td className={`${TD} text-xs text-[#71717a]`}>
                  {r.employment_type}
                </td>
                <td className={TD}>
                  {r.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#15803d]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-[#888888]">Inactive</span>
                  )}
                </td>
                <td className={TD}>
                  {r.auth_user_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#15803d]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                      Đã link
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[#a16207]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#eab308]" />
                      Chưa link
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#888888]">
                  Chưa có nhân viên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
