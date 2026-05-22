import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { getSupabaseServer } from "../../lib/supabase-server";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/work-sessions", label: "Work Sessions" },
  { href: "/patients", label: "Patients" },
  { href: "/tasks", label: "Tasks" },
];

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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 border-r border-gray-200 bg-white px-4 py-6">
        <h1 className="mb-6 text-base font-semibold text-gray-900">
          Dr4Women
        </h1>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-gray-200 pt-4">
          <p className="mb-2 truncate text-xs text-gray-500" title={user.email ?? ""}>
            {user.email}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
