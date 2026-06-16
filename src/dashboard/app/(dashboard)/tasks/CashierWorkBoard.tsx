"use client";

// "Công việc của tôi" của vai THU NGÂN — màn LÀM VIỆC (T-DASH-CASHIER-IA-02).
// 2 mode: Thu ngân thuốc / Thu ngân dịch vụ. Phần thu tiền theo buổi khám CHƯA có
// luồng billing → để PLACEHOLDER rõ ràng (KHÔNG bịa logic thu tiền). Danh mục giá
// nằm ở 2 trang riêng (Bảng giá thuốc / dịch vụ) — link nhanh ở mỗi mode.

import { useState } from "react";
import Link from "next/link";
import { Pill, Tag, ArrowRight } from "lucide-react";

type Mode = "thuoc" | "dich_vu";

const MODES: { key: Mode; label: string; priceHref: string; priceLabel: string }[] = [
  { key: "thuoc", label: "Thu ngân thuốc", priceHref: "/cashier/thuoc", priceLabel: "Bảng giá thuốc" },
  { key: "dich_vu", label: "Thu ngân dịch vụ", priceHref: "/cashier/dich-vu", priceLabel: "Bảng giá dịch vụ" },
];

export default function CashierWorkBoard() {
  const [mode, setMode] = useState<Mode>("thuoc");
  const active = MODES.find((m) => m.key === mode)!;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Công việc của tôi</h1>
        <p className="text-sm text-[#888888]">
          Màn thu ngân — chọn chế độ thu tiền theo thuốc hoặc dịch vụ.
        </p>
      </header>

      {/* Toggle 2 mode làm việc */}
      <div className="inline-flex rounded-xl border border-[#e4e4e7] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors " +
              (mode === m.key
                ? "bg-[#ec4899] text-white"
                : "text-[#52525b] hover:bg-[#fdf2f8]")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Body — PLACEHOLDER luồng thu tiền (chưa có billing) */}
      <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-[#fafafa] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fce7f3] text-[#ec4899]">
          {mode === "thuoc" ? <Pill size={22} /> : <Tag size={22} />}
        </div>
        <p className="text-sm font-medium text-[#171717]">{active.label}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#888888]">
          Thu tiền theo buổi khám sẽ nối khi có luồng billing. Hiện chưa có dữ liệu
          phiếu thu — phần này là khung chờ tích hợp.
        </p>
        <Link
          href={active.priceHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#f3cfe0] px-3 py-2 text-sm font-medium text-[#9d2463] hover:bg-[#fdf2f8]"
        >
          Mở {active.priceLabel} <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
