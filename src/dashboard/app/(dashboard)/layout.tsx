import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "./Nav";
import { leaveClinic } from "../(auth)/enter/actions";
import { getSupabaseServer } from "../../lib/supabase-server";
import { getClinicRole, getClinicStaffId } from "../../lib/clinic-session";
import { ROLE_LABEL, isDoctorRole } from "../../lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getClinicRole();
  if (!role) redirect("/role-picker");

  // For a doctor, show the picked name; the cookie identity drives all scoping.
  let identity = ROLE_LABEL[role];
  if (isDoctorRole(role)) {
    const staffId = await getClinicStaffId();
    if (staffId) {
      const supabase = await getSupabaseServer();
      const { data } = await supabase
        .from("staff")
        .select("full_name, short_name")
        .eq("id", staffId)
        .maybeSingle();
      if (data) identity = `${ROLE_LABEL[role]} · ${data.short_name ?? data.full_name}`;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans">
      <aside className="flex w-[220px] flex-col bg-[#0a0a0a] px-3 py-5">
        <div className="mb-6 px-3">
          <h1 className="flex items-center gap-2 text-base font-medium text-white">
            <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
            Dr4Women
          </h1>
        </div>
        <Nav role={role} />
        <div className="mt-auto space-y-2 border-t border-[#1f1f1f] px-3 pt-4">
          <p className="truncate text-xs text-[#71717a]" title={identity}>
            {identity}
          </p>
          <Link
            href="/role-picker"
            className="block w-full rounded-md border border-[#262626] px-3 py-1.5 text-center text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
          >
            Đổi vai trò
          </Link>
          <form action={leaveClinic}>
            <button
              type="submit"
              className="w-full rounded-md border border-[#262626] px-3 py-1.5 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
            >
              Thoát
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
