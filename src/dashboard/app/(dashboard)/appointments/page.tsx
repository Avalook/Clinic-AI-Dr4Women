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
        <h1 className="text-xl font-semibold text-gray-900">Lịch hẹn</h1>
        <p className="text-sm text-gray-500">
          Lịch hẹn hôm nay. Read-only.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/appointments?tab=${t.key}`}
              className={
                active
                  ? "border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-600"
                  : "border-b-2 border-transparent px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
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
