// Lịch làm việc — ghi/xoá phân công.
//   POST   { week_start, work_date, shift, station, staff_id?, staff_name? }  → thêm 1 ô
//   DELETE { id }                                                            → xoá 1 ô
// Quản lý: xếp cho BẤT KỲ ai. Nhân sự khác (bác sĩ/lễ tân/điều dưỡng): chỉ TỰ
// đăng ký / xoá ca CỦA MÌNH (staff_id ép = chính mình) — feedback C4.
// Ghi qua service-role (work_roster chỉ có RLS SELECT, write phải bypass bằng key).

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  getClinicRole,
  getClinicStaffId,
  getActiveStaff,
} from "../../../lib/clinic-session";
import { isAdminRole } from "../../../lib/roles";

type Auth =
  | {
      ok: true;
      admin: SupabaseClient;
      isAdmin: boolean;
      staffId: string | null;
      staffName: string;
    }
  | { ok: false; res: NextResponse };

async function authorize(): Promise<Auth> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY chưa cấu hình trên server." },
        { status: 503 },
      ),
    };
  }
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  }
  const isAdmin = isAdminRole(await getClinicRole());
  const staffId = await getClinicStaffId();
  const staff = await getActiveStaff();
  const staffName = staff?.short_name ?? staff?.full_name ?? "";
  // Không phải quản lý mà chưa chọn danh tính → không tự đăng ký ca được.
  if (!isAdmin && !staffId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Chưa chọn danh tính nhân viên." }, { status: 403 }),
    };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true, admin, isAdmin, staffId, staffName };
}

interface PostBody {
  week_start?: string;
  work_date?: string;
  shift?: string;
  station?: string;
  staff_id?: string | null;
  staff_name?: string;
  sort?: number;
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.res;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const week_start = (body.week_start ?? "").trim();
  const work_date = (body.work_date ?? "").trim();
  const station = (body.station ?? "").trim();
  const shift = body.shift === "SANG" || body.shift === "CHIEU" ? body.shift : "FULL";

  // Quản lý: xếp cho người được chọn. Khác: ép staff_id/name = chính mình.
  const staff_id = auth.isAdmin ? body.staff_id || null : auth.staffId;
  const staff_name = auth.isAdmin ? (body.staff_name ?? "").trim() : auth.staffName;

  if (!week_start || !work_date || !station || !staff_name) {
    return NextResponse.json(
      { error: "Thiếu tuần / ngày / vị trí / nhân viên." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.admin
    .from("work_roster")
    .insert({
      week_start,
      work_date,
      shift,
      station,
      staff_id,
      staff_name,
      sort: body.sort ?? 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.res;

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Thiếu id." }, { status: 400 });

  // Không phải quản lý → chỉ được xoá ô CỦA MÌNH.
  if (!auth.isAdmin) {
    const { data: row } = await auth.admin
      .from("work_roster")
      .select("staff_id")
      .eq("id", id)
      .maybeSingle();
    if (!row || row.staff_id !== auth.staffId) {
      return NextResponse.json(
        { error: "Chỉ được xoá ca của chính mình." },
        { status: 403 },
      );
    }
  }

  const { error } = await auth.admin.from("work_roster").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
