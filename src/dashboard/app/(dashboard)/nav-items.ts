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
  Contact,
  Stethoscope,
  FlaskConical,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { type ClinicRole, isNurseRole } from "../../lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shorter label for the cramped bottom bar (falls back to label). */
  shortLabel?: string;
  /** Small tag shown next to the label (e.g. "Đang XD"). */
  badge?: string;
}

export const NAV: NavItem[] = [
  { href: "/home", label: "Trang chủ", shortLabel: "Trang chủ", icon: Home },
  {
    href: "/appointments",
    label: "Lịch hẹn (check đặt lịch)",
    shortLabel: "Lịch hẹn",
    icon: ClipboardList,
  },
  {
    href: "/customers",
    label: "Thông tin khách hàng",
    shortLabel: "Khách hàng",
    icon: Contact,
  },
  {
    href: "/patient-list",
    label: "Danh sách bệnh nhân",
    shortLabel: "BN đã khám",
    icon: Stethoscope,
  },
  { href: "/patients", label: "Bệnh nhân (tra cứu)", shortLabel: "Tra cứu", icon: Users },
  {
    href: "/patients/new",
    label: "Nhập thông tin khách hàng mới",
    shortLabel: "Nhập KH",
    icon: UserPlus,
  },
  // Check-in ĐÃ chuyển lên TRANG CHỦ (HomeCheckin) — không còn ở sidebar.
  {
    href: "/tasks",
    label: "Công việc của tôi",
    shortLabel: "Việc",
    icon: CheckSquare,
  },
  {
    href: "/lab-queue",
    label: "Hàng đợi xét nghiệm",
    shortLabel: "Xét nghiệm",
    icon: FlaskConical,
  },
  {
    href: "/service-queue",
    label: "Hàng đợi dịch vụ",
    shortLabel: "Dịch vụ",
    icon: Activity,
  },
  { href: "/schedule", label: "Lịch làm việc", shortLabel: "Ca trực", icon: Calendar },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

// Nhãn theo vai trò: điều dưỡng thấy "khách vãng lai" thay cho "khách hàng mới".
export function navLabelFor(
  item: NavItem,
  role: ClinicRole | null,
  short = false,
): string {
  if (item.href === "/patients/new" && isNurseRole(role)) {
    return short ? "Vãng lai" : "Nhập thông tin khách vãng lai";
  }
  return short ? (item.shortLabel ?? item.label) : item.label;
}

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
