"use client";

// Sidebar nav links. Client component so it can highlight the active route
// via usePathname (the layout itself stays a Server Component).
// ``adminOnly`` items render only when the layout passes ``isAdmin``.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  ClipboardList,
  CheckSquare,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/home", label: "Trang chủ", icon: Home },
  { href: "/work-sessions", label: "Ca trực", icon: Calendar },
  { href: "/patients", label: "Bệnh nhân", icon: Users },
  { href: "/appointments", label: "Lịch hẹn", icon: ClipboardList },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, adminOnly: true },
  { href: "/settings", label: "Cài đặt", icon: Settings, adminOnly: true },
];

export default function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const visible = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="space-y-0.5">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "flex items-center gap-2.5 border-l-2 border-[#ec4899] bg-[#1f1f1f] px-3 py-2 text-sm font-medium text-white transition-colors duration-150"
                : "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
            }
          >
            <Icon size={16} strokeWidth={2} className="shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
