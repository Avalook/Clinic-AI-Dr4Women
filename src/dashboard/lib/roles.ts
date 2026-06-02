// Pure role logic — NO next/headers import, so it is safe to use from both
// Server Components and Client Components (e.g. Nav.tsx).
//
// Access model (post-refactor): ONE shared Supabase login gates the app, then
// the ACTIVE ROLE is app-state chosen at /role-picker and stored in a cookie.
// These helpers operate on that role string, not on a staff row.

export type ClinicRole =
  | "DOCTOR"
  | "ULTRASOUND_DOCTOR"
  | "NURSE_ULTRASOUND"
  | "CSKH"
  | "MANAGEMENT"
  | "RECEPTION";

export const ALL_ROLES: ClinicRole[] = [
  "DOCTOR",
  "ULTRASOUND_DOCTOR",
  "NURSE_ULTRASOUND",
  "CSKH",
  "MANAGEMENT",
  "RECEPTION",
];

// staff.primary_department → vai trò ứng dụng. Mỗi người chọn tên mình khi
// đăng nhập; vai trò (và nav) suy ra từ chức danh, không tin client.
export function departmentToRole(dept: string | null | undefined): ClinicRole {
  return isClinicRole(dept ?? "") ? (dept as ClinicRole) : "CSKH";
}

export function isClinicRole(v: string | undefined | null): v is ClinicRole {
  return !!v && (ALL_ROLES as string[]).includes(v);
}

const DOCTOR_ROLES = new Set<ClinicRole>(["DOCTOR", "ULTRASOUND_DOCTOR"]);

/** Doctor / ultrasound doctor — can scope appointments to themselves. */
export function isDoctorRole(role: ClinicRole | null): boolean {
  return role !== null && DOCTOR_ROLES.has(role);
}

/** MANAGEMENT only — sees Reports + Settings + Ca trực. */
export function isAdminRole(role: ClinicRole | null): boolean {
  return role === "MANAGEMENT";
}

/** Roles allowed to create patients / appointments (data entry). */
export function canWriteIntake(role: ClinicRole | null): boolean {
  return role === "CSKH" || role === "RECEPTION" || role === "MANAGEMENT";
}

/** Landing path after a role is picked. */
export function roleLanding(role: ClinicRole | null): string {
  if (isDoctorRole(role)) return "/appointments?scope=me";
  return "/home";
}

export const ROLE_LABEL: Record<ClinicRole, string> = {
  DOCTOR: "Bác sĩ",
  ULTRASOUND_DOCTOR: "Bác sĩ Siêu âm",
  NURSE_ULTRASOUND: "Điều dưỡng / Phụ siêu âm",
  CSKH: "CSKH",
  MANAGEMENT: "Quản lý",
  RECEPTION: "Lễ tân",
};

// Which roles may see each sidebar destination. Anything not listed = everyone.
// RECEPTION (Lễ tân) is a front-desk role with a deliberately small menu:
// only Trang chủ + Nhập khách hàng + Check-in. So the broader destinations
// are scoped to everyone-except-reception.
// Lịch làm việc: bác sĩ/điều dưỡng xem ca trực của mình + quản lý xem cả bảng.
// CSKH & Lễ tân KHÔNG xem (sidebar gọn theo đầu việc của họ).
const ROSTER_ROLES: ClinicRole[] = [
  "DOCTOR",
  "ULTRASOUND_DOCTOR",
  "NURSE_ULTRASOUND",
  "MANAGEMENT",
];
// Bệnh nhân + lịch hẹn: bác sĩ (giới hạn BN của mình) + quản lý. Điều dưỡng,
// CSKH, Lễ tân KHÔNG vào danh sách BN/lịch hẹn — sidebar gọn theo việc của họ.
const PATIENT_STAFF: ClinicRole[] = [
  "DOCTOR",
  "ULTRASOUND_DOCTOR",
  "MANAGEMENT",
];

const NAV_ROLES: Record<string, "all" | ClinicRole[]> = {
  "/home": "all",
  "/appointments": PATIENT_STAFF,
  "/patients": PATIENT_STAFF,
  "/patients/new": ["CSKH", "RECEPTION", "MANAGEMENT"],
  "/checkin": ["RECEPTION", "MANAGEMENT"],
  "/tasks": ["CSKH", "MANAGEMENT"],
  "/schedule": ROSTER_ROLES,
  "/work-sessions": ["MANAGEMENT"],
  "/reports": ["MANAGEMENT"],
  "/settings": ["MANAGEMENT"],
};

export function canSeeNav(role: ClinicRole | null, href: string): boolean {
  const rule = NAV_ROLES[href];
  if (!rule || rule === "all") return true;
  return role !== null && rule.includes(role);
}
