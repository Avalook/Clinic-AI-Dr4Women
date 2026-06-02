"use client";

// Sidebar nav links. Visibility is per-role (see canSeeNav in lib/roles).
// Client component so it can highlight the active route via usePathname.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Users,
  UserPlus,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { canSeeNav, type ClinicRole } from "../../lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/home", label: "Trang chủ", icon: Home },
  { href: "/appointments", label: "Lịch hẹn", icon: ClipboardList },
  { href: "/patients", label: "Bệnh nhân", icon: Users },
  { href: "/patients/new", label: "Nhập BN mới", icon: UserPlus },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/work-sessions", label: "Ca trực", icon: Calendar },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

// Active = exact match, or a nested path with no more-specific nav item also
// matching (so /patients/new highlights itself, not /patients).
function isActive(href: string, pathname: string, hrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !hrefs.some(
    (h) =>
      h !== href &&
      h.startsWith(href + "/") &&
      (pathname === h || pathname.startsWith(h + "/")),
  );
}

export default function Nav({
  role,
  onNavigate,
}: {
  role: ClinicRole | null;
  /** Called after a nav item is tapped (used to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => canSeeNav(role, item.href));
  const hrefs = visible.map((v) => v.href);

  return (
    <nav className="space-y-0.5">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname, hrefs);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
