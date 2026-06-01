// Role picker — shown right after the clinic password gate. Lists active
// doctors so a doctor can pick their own name (scopes "lịch của tôi").

import { getSupabaseServer } from "../../lib/supabase-server";
import RolePicker, { type DoctorOption } from "./RolePicker";

export const dynamic = "force-dynamic";

export default async function RolePickerPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("staff")
    .select("id, full_name, short_name, primary_department")
    .in("primary_department", ["DOCTOR", "ULTRASOUND_DOCTOR"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const doctors = (data as DoctorOption[] | null) ?? [];
  return <RolePicker doctors={doctors} />;
}
