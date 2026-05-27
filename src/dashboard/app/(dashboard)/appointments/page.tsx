// Appointments dashboard: two tabs switched via ?tab=pending|confirmed.
// Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).

import Link from "next/link";
import AppointmentsList from "./AppointmentsList";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "confirmed", label: "Đã xác nhận" },
] as const;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "confirmed" ? "confirmed" : "pending";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Lịch hẹn</h1>
        <p className="text-sm text-[#888888]">Lịch hẹn hôm nay. Read-only.</p>
      </header>

      <nav className="flex gap-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/appointments?tab=${t.key}`}
              className={
                active
                  ? "rounded-md bg-[#171717] px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-md px-3.5 py-1.5 text-sm text-[#71717a] transition-colors duration-150 hover:bg-[#f4f4f5] hover:text-[#171717]"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <AppointmentsList tab={tab} />
    </div>
  );
}
