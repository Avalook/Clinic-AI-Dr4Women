"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_COOKIE, STAFF_COOKIE } from "../../lib/clinic-session";
import { isClinicRole, isDoctorRole, roleLanding } from "../../lib/roles";

// Persist the picked role (+ doctor identity) in cookies, then land the user.
export async function chooseRole(formData: FormData): Promise<void> {
  const role = String(formData.get("role") ?? "");
  const staffId = String(formData.get("staffId") ?? "").trim();
  if (!isClinicRole(role)) redirect("/role-picker");

  // A doctor must have picked their name (for "lịch của tôi" scope).
  if (isDoctorRole(role) && !staffId) redirect("/role-picker");

  const c = await cookies();
  const opts = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 12, // one clinic workday
  };
  c.set(ROLE_COOKIE, role, opts);
  if (isDoctorRole(role)) {
    c.set(STAFF_COOKIE, staffId, opts);
  } else {
    c.delete(STAFF_COOKIE);
  }
  redirect(roleLanding(role));
}
