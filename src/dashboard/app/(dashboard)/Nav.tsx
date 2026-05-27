"use client";

// Sidebar nav links. Client component so it can highlight the active route
// via usePathname (the layout itself stays a Server Component).

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/work-sessions", label: "Ca trực", icon: "🗓" },
  { href: "/patients", label: "Bệnh nhân", icon: "👤" },
  { href: "/appointments", label: "Lịch hẹn", icon: "📋" },
  { href: "/tasks", label: "Công việc", icon: "✓" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex items-center gap-2.5 border-l-2 border-[#6366f1] bg-[#1a1a1a] px-3 py-2 text-sm font-medium text-white transition-colors duration-150"
                : "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
            }
          >
            <span className="w-4 text-center text-[13px]">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
