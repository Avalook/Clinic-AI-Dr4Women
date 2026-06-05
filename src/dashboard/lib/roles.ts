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

/** Điều dưỡng / phụ siêu âm. */
export function isNurseRole(role: ClinicRole | null): boolean {
  return role === "NURSE_ULTRASOUND";
}

/** Roles allowed to create patients / appointments (data entry).
 *  Điều dưỡng (NURSE) thêm vào để nhập "khách vãng lai" + check-in. */
export function canWriteIntake(role: ClinicRole | null): boolean {
  return (
    role === "CSKH" ||
    role === "RECEPTION" ||
    role === "MANAGEMENT" ||
    role === "NURSE_ULTRASOUND"
  );
}

/** Roles lo check-in (đón khách đã đến). Khu check-in giờ nằm ở TRANG CHỦ
 *  (không còn ở sidebar) cho Điều dưỡng + Lễ tân + Quản lý. */
export function canCheckin(role: ClinicRole | null): boolean {
  return (
    role === "NURSE_ULTRASOUND" ||
    role === "RECEPTION" ||
    role === "MANAGEMENT"
  );
}

/** Roles quản trị vòng đời lịch hẹn: HỦY lịch + PHÂN LẠI bác sĩ (CSKH + Quản lý). */
export function canManageAppt(role: ClinicRole | null): boolean {
  return role === "CSKH" || role === "MANAGEMENT";
}

/** Roles được SỬA thông tin hành chính BN (mục I): nhóm intake (CSKH/Lễ tân/QL/ĐD)
 *  + BÁC SĨ. Bác sĩ KHÔNG tạo BN (canWriteIntake) nhưng được sửa hồ sơ hành chính
 *  (vd trong "Danh sách bệnh nhân"). KHÔNG đụng CCCD/định danh. */
export function canEditPatient(role: ClinicRole | null): boolean {
  return canWriteIntake(role) || isDoctorRole(role);
}

/** Lễ tân xem "Công việc của tôi" (board bác sĩ) nhưng CHỈ ĐỌC — mọi nút
 *  Nhận/Từ chối/Lưu hồ sơ/Chỉ định XN đều bị khóa. Dùng để clone giao diện
 *  bác sĩ cho front desk mà không cấp quyền ghi. */
export function isTasksReadOnly(role: ClinicRole | null): boolean {
  return role === "RECEPTION";
}

/** Landing path after a role is picked. */
export function roleLanding(role: ClinicRole | null): string {
  if (isDoctorRole(role)) return "/tasks";
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
// Bác sĩ (DOCTOR + Bác sĩ siêu âm): việc chính gom ở "Công việc của tôi"
// (/tasks). Thêm "Lịch làm việc" (/schedule) để TỰ đăng ký ca của mình (feedback
// C4). /appointments + /patients/new vẫn KHÔNG cho bác sĩ (chỉ Quản lý / front
// desk). /patients giờ mở cho CSKH + Lễ tân tra cứu (feedback B1).
const DOCTOR_ROLES_LIST: ClinicRole[] = ["DOCTOR", "ULTRASOUND_DOCTOR"];

const NAV_ROLES: Record<string, "all" | ClinicRole[]> = {
  "/home": "all",
  "/appointments": ["MANAGEMENT"],
  // Thông tin khách hàng (danh bạ + chi tiết + tra cứu tên/mã/SĐT) — CSKH/Lễ tân/QL.
  "/customers": ["CSKH", "RECEPTION", "MANAGEMENT"],
  // Danh sách bệnh nhân ĐÃ KHÁM (lần đầu / tái khám) — CSKH/Lễ tân/QL + BÁC SĨ.
  // Bác sĩ thấy TOÀN BỘ BN đã khám (như front desk); mở hồ sơ vẫn bị guard
  // patients/[id] (chỉ mở được BN của mình) — đúng mô hình quyền hiện tại.
  "/patient-list": ["CSKH", "RECEPTION", "MANAGEMENT", ...DOCTOR_ROLES_LIST],
  // Tra cứu BN đầy đủ (phân trang) — Quản lý. CSKH/Lễ tân dùng /customers.
  "/patients": ["MANAGEMENT"],
  // Điều dưỡng cũng nhập được (khách vãng lai).
  "/patients/new": ["CSKH", "RECEPTION", "MANAGEMENT", "NURSE_ULTRASOUND"],
  // /checkin đã chuyển hẳn lên Trang chủ (HomeCheckin) — route cũ đã xóa.
  // Lễ tân được THÊM vào: thấy "Công việc của tôi" nhưng ở chế độ CHỈ XEM
  // (clone giao diện board bác sĩ, khóa mọi nút sửa — xem isTasksReadOnly).
  "/tasks": ["CSKH", "MANAGEMENT", "RECEPTION", ...DOCTOR_ROLES_LIST],
  // Hàng đợi XN + Dịch vụ: điều dưỡng/KTV thực hiện (+ Quản lý xem).
  "/lab-queue": ["NURSE_ULTRASOUND", "MANAGEMENT"],
  "/service-queue": ["NURSE_ULTRASOUND", "MANAGEMENT"],
  // Bác sĩ + Lễ tân + Điều dưỡng tự đăng ký ca của mình; Quản lý xếp cả bảng (feedback C4).
  "/schedule": [...DOCTOR_ROLES_LIST, "NURSE_ULTRASOUND", "RECEPTION", "MANAGEMENT"],
  "/work-sessions": ["MANAGEMENT"],
  "/reports": ["MANAGEMENT"],
  "/settings": ["MANAGEMENT"],
};

export function canSeeNav(role: ClinicRole | null, href: string): boolean {
  const rule = NAV_ROLES[href];
  if (!rule || rule === "all") return true;
  return role !== null && rule.includes(role);
}
