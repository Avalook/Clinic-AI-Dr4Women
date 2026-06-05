"use client";

// Responsive shell.
//  - ≥md: persistent dark sidebar (desktop).
//  - <md: slim top bar (brand) + bottom tab bar (thumb-reach navigation,
//    native-app style). The bottom bar's "Menu" opens a slide-in drawer with
//    the full nav list, role switch, and logout.

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import Nav from "./Nav";
import BottomNav from "./BottomNav";
import { type ClinicRole } from "../../lib/roles";

interface ShellProps {
  role: ClinicRole;
  identity: string;
  leaveAction: () => void | Promise<void>;
  children: React.ReactNode;
}

export default function Shell({
  role,
  identity,
  leaveAction,
  children,
}: ShellProps) {
  // Drawer is opened from the bottom bar's "Menu"; each link / action closes it.
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Prevent body scroll when the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const sidebarContent = (
    <>
      <div className="mb-6 flex items-center justify-between px-3">
        <h1 className="flex items-center gap-2 text-base font-medium text-white">
          <Image
            src="/logo.png"
            alt="Dr4Women"
            width={24}
            height={24}
            className="rounded-full object-contain"
          />
          Dr4Women
        </h1>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
          className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-white md:hidden"
        >
          <X size={20} />
        </button>
      </div>
      <Nav role={role} onNavigate={() => setOpen(false)} />
      <div className="mt-4 space-y-2 border-t border-[#1f1f1f] px-3 pt-4">
        <p className="truncate text-xs text-[#71717a]" title={identity}>
          {identity}
        </p>
        <form action={leaveAction}>
          <button
            type="submit"
            className="w-full rounded-md border border-[#262626] px-3 py-2 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8] active:bg-[#1a1a1a]"
          >
            Thoát
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans">
      {/* Mobile top bar (brand only). Hidden on ≥md. */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-12 items-center justify-center border-b border-[#1f1f1f] bg-[#0a0a0a] px-3 md:hidden">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Image
            src="/logo.png"
            alt="Dr4Women"
            width={24}
            height={24}
            className="rounded-full object-contain"
          />
          Dr4Women
        </span>
      </header>

      {/* Desktop sidebar (≥md). */}
      <aside className="hidden w-[220px] flex-col bg-[#0a0a0a] px-3 py-5 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer (<md), opened from the bottom bar's Menu. */}
      {/* Mobile drawer — luôn mount, trượt vào/ra bằng CSS transition (mượt cả 2 chiều). */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-[#0a0a0a] px-3 py-5 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Content. Padding leaves room for the mobile top bar + bottom nav. */}
      <main className="min-w-0 flex-1 p-4 pb-24 pt-16 md:p-8 md:pb-8 md:pt-8">
        {/* key=pathname → fade chạy lại mỗi lần đổi trang */}
        <div key={pathname} className="page-in">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar (<md). */}
      <BottomNav role={role} onMenu={() => setOpen(true)} />
    </div>
  );
}
