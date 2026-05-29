import LogoutButton from "./LogoutButton";
import Nav from "./Nav";
import { getSupabaseServer } from "../../lib/supabase-server";
import { getCurrentStaff, isAdminRole } from "../../lib/current-staff";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Role flag drives the admin-only Nav entries (Báo cáo / Cài đặt).
  // Cached via React.cache so the home/appointments/etc pages do not
  // re-issue the same staff query.
  const staff = await getCurrentStaff();
  const isAdmin = isAdminRole(staff);

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans">
      <aside className="flex w-[220px] flex-col bg-[#0a0a0a] px-3 py-5">
        <div className="mb-6 px-3">
          <h1 className="flex items-center gap-2 text-base font-medium text-white">
            <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
            Dr4Women
          </h1>
        </div>
        <Nav isAdmin={isAdmin} />
        <div className="mt-auto border-t border-[#1f1f1f] px-3 pt-4">
          <p
            className="mb-2 truncate text-xs text-[#71717a]"
            title={user.email ?? ""}
          >
            {user.email}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
