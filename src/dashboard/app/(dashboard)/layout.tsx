import LogoutButton from "./LogoutButton";
import Nav from "./Nav";
import { getSupabaseServer } from "../../lib/supabase-server";
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

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans">
      <aside className="flex w-[220px] flex-col bg-[#0a0a0a] px-3 py-5">
        <div className="mb-6 px-3">
          <h1 className="flex items-center gap-2 text-base font-medium text-white">
            <span className="h-2 w-2 rounded-full bg-[#6366f1]" />
            Dr4Women
          </h1>
        </div>
        <Nav />
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
