"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={handleLogout}
      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
    >
      Đăng xuất
    </button>
  );
}
