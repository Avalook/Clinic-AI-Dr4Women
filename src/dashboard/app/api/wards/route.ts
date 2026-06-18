// /api/wards?province=<code> → danh sách phường/xã của 1 tỉnh (sau sáp nhập, bỏ
// huyện). Data tham chiếu hành chính tĩnh — đọc qua Supabase (RLS SELECT). Dùng
// cho dropdown phụ thuộc ở form nhập BN (chọn tỉnh → load phường).

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const province = new URL(request.url).searchParams.get("province")?.trim();
  if (!province) {
    return NextResponse.json({ wards: [] });
  }
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("ward")
    .select("code, name, full_name")
    .eq("province_code", province)
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ wards: data ?? [] });
}
