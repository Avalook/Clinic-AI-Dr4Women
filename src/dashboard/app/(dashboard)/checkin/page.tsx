// Check-in bệnh nhân — ĐANG XÂY DỰNG.
// Màn hình tương lai: Lễ tân tra cứu lịch hẹn hôm nay → xác nhận BN đã đến
// (CHECKED_IN), in số thứ tự, đẩy vào hàng đợi khám. Hiện chỉ là placeholder.

import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { getClinicRole } from "../../../lib/clinic-session";
import { canSeeNav } from "../../../lib/roles";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const role = await getClinicRole();
  // Chỉ vai trò được phép thấy mục này mới vào được.
  if (!canSeeNav(role, "/checkin")) redirect("/home");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Check-in bệnh nhân
        </h1>
        <p className="text-sm text-[#888888]">
          Xác nhận bệnh nhân đã đến & đưa vào hàng đợi khám.
        </p>
      </header>

      <div className="flex flex-col items-center rounded-xl border border-dashed border-[#e4e4e7] bg-white px-6 py-14 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fce7f3] text-[#db2777]">
          <UserCheck size={26} />
        </span>
        <h2 className="text-base font-semibold text-[#171717]">
          Đang xây dựng
        </h2>
        <p className="mt-1 max-w-sm text-sm text-[#71717a]">
          Tính năng check-in cho bệnh nhân sẽ sớm có: tra cứu lịch hẹn hôm nay,
          xác nhận khách đã đến, cấp số thứ tự và đẩy vào hàng đợi khám.
        </p>
        <Link
          href="/home"
          className="mt-6 rounded-lg border border-[#e4e4e7] px-4 py-2 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5]"
        >
          ← Về trang chủ
        </Link>
      </div>
    </div>
  );
}
