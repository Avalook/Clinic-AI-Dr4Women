// Next 16 proxy file (renamed from `middleware` per the deprecation notice).
// Session refresh + auth gate: any request below the (dashboard) route group
// requires an authenticated user.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    // Role-aware landing: pull the linked staff row and pick the
    // destination per the same rule as current-staff.ts → roleLanding().
    // Doing it here (not on /home) means BS clicking "Trang chủ" later
    // still gets to see /home rather than bouncing to /appointments.
    const { data: staff } = await supabase
      .from("staff")
      .select("primary_department")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const dept = staff?.primary_department;
    let landing = "/home";
    if (dept === "DOCTOR" || dept === "ULTRASOUND_DOCTOR") {
      landing = "/appointments?scope=me";
    } else if (dept === "CSKH") {
      landing = "/tasks";
    }

    const url = request.nextUrl.clone();
    const [path, search] = landing.split("?");
    url.pathname = path;
    url.search = search ? `?${search}` : "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next internals + static assets. Everything else passes through the gate.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
