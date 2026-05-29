// Admin-only user creation endpoint (F3). The dashboard exposes a
// form at /settings/new-user that POSTs here with
//   { email, password, staffId }.
//
// Flow:
//   1. Verify the caller's Supabase session and that the linked staff
//      row has primary_department === 'MANAGEMENT'. Anything else gets
//      a 403 with no further info.
//   2. Verify the target staffId exists and has NO auth_user_id yet
//      (one staff ↔ one auth user; see migration 025).
//   3. Use the service-role client to create the Auth user (auto
//      email_confirm = true so admin-created accounts skip the
//      activation email).
//   4. UPDATE staff.auth_user_id = <new uid> via the service-role
//      client (RLS bypass needed since /settings/new-user fires from
//      the user's session, which lacks write to staff).
//   5. Return the new user's id and email; or rollback (delete the
//      just-created Auth user) on the UPDATE failure.
//
// SECURITY
// - SUPABASE_SERVICE_ROLE_KEY is read from the server environment only.
//   It is never sent to the client.
// - The endpoint refuses every method except POST.
// - The endpoint refuses if SUPABASE_SERVICE_ROLE_KEY is unset, so a
//   misconfigured deployment fails closed.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "../../../../lib/supabase-server";

interface CreateBody {
  email?: string;
  password?: string;
  staffId?: string;
}

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  // 0. Sanity: env var present?
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. " +
          "Add it to .env and restart the dashboard.",
      },
      { status: 503 },
    );
  }

  // 1. Caller must be authenticated AND admin.
  const callerClient = await getSupabaseServer();
  const {
    data: { user },
  } = await callerClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { data: callerStaff } = await callerClient
    .from("staff")
    .select("primary_department")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (callerStaff?.primary_department !== "MANAGEMENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse + validate body.
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const staffId = (body.staffId ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.` },
      { status: 400 },
    );
  }
  if (!staffId) {
    return NextResponse.json(
      { error: "Phải chọn nhân viên để link." },
      { status: 400 },
    );
  }

  // 3. Service-role client for the privileged ops.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Target staff exists + still unlinked?
  const { data: targetStaff, error: targetErr } = await admin
    .from("staff")
    .select("id, full_name, auth_user_id")
    .eq("id", staffId)
    .maybeSingle();
  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 500 });
  }
  if (!targetStaff) {
    return NextResponse.json(
      { error: "Nhân viên không tồn tại." },
      { status: 404 },
    );
  }
  if (targetStaff.auth_user_id) {
    return NextResponse.json(
      { error: "Nhân viên này đã được link với tài khoản khác." },
      { status: 409 },
    );
  }

  // 4. Create the Auth user (auto-confirmed so the operator can hand
  //    over the credentials immediately).
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { error: created.error?.message ?? "Failed to create user" },
      { status: 500 },
    );
  }
  const newUserId = created.data.user.id;

  // 5. Link staff.auth_user_id. Rollback the Auth user on failure so
  //    we don't strand an unlinkable account.
  const linkRes = await admin
    .from("staff")
    .update({ auth_user_id: newUserId })
    .eq("id", staffId)
    .is("auth_user_id", null);
  if (linkRes.error) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      {
        error:
          "Linked staff row update failed; the Auth user was rolled back. " +
          linkRes.error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    userId: newUserId,
    email,
    staffId,
    staffName: targetStaff.full_name,
  });
}
