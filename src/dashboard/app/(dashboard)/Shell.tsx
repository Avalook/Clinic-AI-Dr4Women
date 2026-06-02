"use client";

// Responsive shell: persistent sidebar on ≥md, hamburger + slide-in drawer
// on <md. The dashboard layout (server) computes identity + nav visibility
// and hands the inner pieces here as props.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Nav from "./Nav";
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
  // Each nav Link, "Đổi vai trò" link, and "Thoát" submit closes the drawer
  // via the onClick handlers below — no pathname-watching effect needed.
  const [open, setOpen] = useState(false);

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
          <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
          Dr4Women
        </h1>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
          className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-white md:hidden"
        >
          <X size={18} />
        </button>
      </div>
      <Nav role={role} onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-2 border-t border-[#1f1f1f] px-3 pt-4">
        <p className="truncate text-xs text-[#71717a]" title={identity}>
          {identity}
        </p>
        <Link
          href="/role-picker"
          onClick={() => setOpen(false)}
          className="block w-full rounded-md border border-[#262626] px-3 py-1.5 text-center text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
        >
          Đổi vai trò
        </Link>
        <form action={leaveAction}>
          <button
            type="submit"
            className="w-full rounded-md border border-[#262626] px-3 py-1.5 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8]"
          >
            Thoát
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans">
      {/* Mobile topbar (hamburger + brand). Hidden on ≥md. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở menu"
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-[#1a1a1a]"
        >
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
          Dr4Women
        </span>
        <span aria-hidden className="w-9" />
      </header>

      {/* Desktop sidebar (≥md). Same content as the drawer. */}
      <aside className="hidden w-[220px] flex-col bg-[#0a0a0a] px-3 py-5 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer (<md, conditional). Overlay + slide-in. */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-[#0a0a0a] px-3 py-5 shadow-2xl md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Content. Top padding leaves room for the mobile topbar. */}
      <main className="min-w-0 flex-1 p-4 pt-16 md:p-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}
