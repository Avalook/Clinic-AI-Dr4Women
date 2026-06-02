"use client";

// Desktop sidebar nav links + the drawer's link list. Visibility is per-role
// (see canSeeNav). Client component so it can highlight the active route.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSeeNav, type ClinicRole } from "../../lib/roles";
import { NAV, isActiveNav } from "./nav-items";

export default function Nav({
  role,
  onNavigate,
}: {
  role: ClinicRole | null;
  /** Called after a nav item is tapped (used to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => canSeeNav(role, item.href));
  const hrefs = visible.map((v) => v.href);

  return (
    <nav className="space-y-0.5">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = isActiveNav(href, pathname, hrefs);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={
              active
                ? "flex items-center gap-2.5 border-l-2 border-[#ec4899] bg-[#1f1f1f] px-3 py-2.5 text-sm font-medium text-white transition-colors duration-150"
                : "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2.5 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#d4d4d8] active:bg-[#1a1a1a]"
            }
          >
            <Icon size={16} strokeWidth={2} className="shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
