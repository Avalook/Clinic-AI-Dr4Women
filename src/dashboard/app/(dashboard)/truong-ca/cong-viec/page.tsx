// "Công việc của tôi" của TRƯỞNG CA — PLACEHOLDER. Nội dung thật chờ MẪU BÁO CÁO
// của phòng khám (PK 24/6). Để trống có chủ đích + ghi chú, KHÔNG dựng logic tạm
// dễ lệch yêu cầu. Gate read-only (requireNavAccess) như mọi trang dashboard.

import { requireNavAccess } from "../../../../lib/clinic-session";

export const dynamic = "force-dynamic";

export default async function TruongCaCongViecPage() {
  await requireNavAccess("/truong-ca/cong-viec");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Công việc của tôi</h1>
        <p className="text-sm text-[#888888]">Trưởng ca</p>
      </header>

      <div className="rounded-xl border border-dashed border-[#f3cfe0] bg-[#fdf2f8] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[#9d2463]">Đang xây dựng</p>
        <p className="mt-1 text-sm text-[#888888]">
          Chờ mẫu báo cáo PK 24/6 để dựng danh sách việc của Trưởng ca.
        </p>
      </div>
    </div>
  );
}
