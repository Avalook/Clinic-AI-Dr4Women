// Lịch làm việc — ghi/xoá phân công (admin only).
//   POST   { week_start, work_date, shift, station, staff_id?, staff_name }  → thêm 1 ô
//   DELETE { id }                                                            → xoá 1 ô
// Mọi method: caller phải có session + vai trò MANAGEMENT; ghi qua service-role
// (bảng work_roster chỉ có RLS SELECT, write phải bypass bằng service key).

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole } from "../../../lib/clinic-session";

type AuthResult =
  | { ok: true; admin: SupabaseClient }
  | { ok: false; res: NextResponse };

async function authorizeAdmin(): Promise<AuthResult> {
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
  if ((await getClinicRole()) !== "MANAGEMENT") {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true, admin };
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
  const auth = await authorizeAdmin();
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
  const staff_name = (body.staff_name ?? "").trim();
  const shift = body.shift === "SANG" || body.shift === "CHIEU" ? body.shift : "FULL";

  if (!week_start || !work_date || !station || !staff_name) {
    return NextResponse.json(
      { error: "Thiếu tuần / ngày / trạm / nhân viên." },
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
      staff_id: body.staff_id || null,
      staff_name,
      sort: body.sort ?? 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin();
  if (!auth.ok) return auth.res;

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Thiếu id." }, { status: 400 });

  const { error } = await auth.admin.from("work_roster").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
