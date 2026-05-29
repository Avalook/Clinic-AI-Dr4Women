"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "../../../lib/supabase-browser";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // After login, route to ``/login`` so proxy.ts picks up the role-aware
  // landing (BS → /appointments?scope=me, CSKH → /tasks, else → /home).
  // The ``?redirect=`` query param wins when present — it carries the
  // path the unauthenticated user originally wanted.
  const redirectParam = params.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // ``router.replace(target)`` triggers a fresh navigation; proxy.ts
    // then resolves the role-aware redirect (when target = /login).
    router.replace(redirectParam || "/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      >
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#171717]">
            <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
            Dr4Women Dashboard
          </h1>
          <p className="text-sm text-[#888888]">
            Đăng nhập bằng tài khoản staff.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-[#4d4d4d]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[#e4e4e7] px-3 py-2 text-sm text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#4d4d4d]"
            >
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#ec4899] hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[#e4e4e7] px-3 py-2 text-sm text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#ec4899] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <p className="text-xs text-[#888888]">
          Chưa có tài khoản? Liên hệ quản trị viên phòng khám.
        </p>
      </form>
    </div>
  );
}
