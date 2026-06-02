"use server";

// Lưu "tôi là ai" cho các vai trò không phải bác sĩ (CSKH/Lễ tân) để lọc
// "lịch của tôi". Bác sĩ đã có staff_id từ role-picker nên không cần.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROSTER_STAFF_COOKIE } from "../../../lib/roster";

export async function setRosterStaff(formData: FormData): Promise<void> {
  const staffId = String(formData.get("staffId") ?? "").trim();
  const c = await cookies();
  if (staffId) {
    c.set(ROSTER_STAFF_COOKIE, staffId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    c.delete(ROSTER_STAFF_COOKIE);
  }
  revalidatePath("/schedule");
}
