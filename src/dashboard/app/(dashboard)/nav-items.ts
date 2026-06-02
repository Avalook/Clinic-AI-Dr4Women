// Shared nav model used by both the desktop sidebar (Nav) and the mobile
// bottom tab bar (BottomNav). Visibility is per-role (see canSeeNav).

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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shorter label for the cramped bottom bar (falls back to label). */
  shortLabel?: string;
}

export const NAV: NavItem[] = [
  { href: "/home", label: "Trang chủ", shortLabel: "Trang chủ", icon: Home },
  {
    href: "/appointments",
    label: "Lịch hẹn (check đặt lịch)",
    shortLabel: "Lịch hẹn",
    icon: ClipboardList,
  },
  { href: "/patients", label: "Bệnh nhân", shortLabel: "Bệnh nhân", icon: Users },
  {
    href: "/patients/new",
    label: "Nhập thông tin Khách hàng",
    shortLabel: "Nhập KH",
    icon: UserPlus,
  },
  {
    href: "/tasks",
    label: "Công việc hàng ngày",
    shortLabel: "Việc",
    icon: CheckSquare,
  },
  { href: "/work-sessions", label: "Ca trực", icon: Calendar },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

// Active = exact match, or a nested path with no more-specific nav item also
// matching (so /patients/new highlights itself, not /patients).
export function isActiveNav(
  href: string,
  pathname: string,
  hrefs: string[],
): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !hrefs.some(
    (h) =>
      h !== href &&
      h.startsWith(href + "/") &&
      (pathname === h || pathname.startsWith(h + "/")),
  );
}
