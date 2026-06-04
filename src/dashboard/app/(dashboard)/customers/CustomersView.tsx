"use client";

// "Thông tin khách hàng" — DANH BẠ khách đã nhập, dạng master-detail:
//   • Trái: danh sách (lọc Hôm nay/Tuần/Tháng/Tất cả + tìm tên/mã/SĐT).
//   • Phải: thông tin chi tiết của khách đang chọn (bôi HỒNG ở list).
// Sau khi tạo khách mới, NewPatientForm điều hướng /customers?selected=<id> →
// khách đó tự được chọn + bôi hồng (feedback: "thông tin sau nhập trả về").
// Lọc + tìm = điều hướng searchParams (server lọc lại); CHỌN = state client.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ExternalLink, X } from "lucide-react";
import { fmtDate, fmtDateTimeOrDate } from "../../../lib/datetime";

export interface CustomerRow {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  gender: string | null;
  ethnicity: string | null;
  nationality: string | null;
  occupation: string | null;
  patient_objection: string | null;
  address: string | null;
  location_id: string | null;
  created_at: string | null;
}
export interface Opt {
  id: string;
  label: string;
}
export type Period = "today" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "all", label: "Tất cả" },
];

export default function CustomersView({
  rows,
  locations,
  q,
  period,
  initialSelected,
}: {
  rows: CustomerRow[];
  locations: Opt[];
  q: string;
  period: Period;
  initialSelected: string | null;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(
    initialSelected ?? rows[0]?.clinic_patient_id ?? null,
  );
  const [term, setTerm] = useState(q);

  const selected =
    rows.find((r) => r.clinic_patient_id === sel) ?? rows[0] ?? null;
  const locName = (id: string | null) =>
    locations.find((l) => l.id === id)?.label ?? "—";

  function go(nextPeriod: Period, nextQ: string) {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set("q", nextQ.trim());
    if (nextPeriod !== "all") p.set("period", nextPeriod);
    const qs = p.toString();
    router.push(`/customers${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-3">
      {/* Bộ lọc + tìm kiếm */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => go(p.key, term)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                (period === p.key
                  ? "bg-[#ec4899] text-white"
                  : "border border-[#f3cfe0] bg-white text-[#9d2463] hover:bg-[#fdf2f8]")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(period, term);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Tìm tên / mã BN / SĐT…"
              className="min-h-9 w-full rounded-lg border border-[#e4e4e7] bg-white pl-8 pr-3 text-sm outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/15 sm:w-64"
            />
          </div>
          <button
            type="submit"
            className="min-h-9 rounded-lg bg-[#ec4899] px-3 text-sm font-medium text-white hover:bg-[#db2777]"
          >
            Tìm
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                go(period, "");
              }}
              className="min-h-9 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm text-[#52525b] hover:bg-[#f4f4f5]"
            >
              Xoá
            </button>
          )}
        </form>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* DANH SÁCH (trái) */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-xs text-[#888888]">
            {rows.length} khách hàng
          </div>
          <div className="h-[560px] max-h-[80vh] overflow-y-auto rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
            {rows.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-[#a1a1aa]">
                Chưa có khách hàng nào trong khoảng lọc này. Nhập ở “Nhập thông
                tin khách hàng mới”.
              </p>
            ) : (
              <ul className="divide-y divide-[#f6e0ec]">
                {rows.map((r) => {
                  const active = r.clinic_patient_id === selected?.clinic_patient_id;
                  return (
                    <li key={r.clinic_patient_id}>
                      <button
                        onClick={() => setSel(r.clinic_patient_id)}
                        className={
                          "flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors " +
                          (active
                            ? "bg-[#fce7f3]"
                            : "hover:bg-[#fdf2f8]")
                        }
                      >
                        <span
                          className={
                            "truncate text-sm font-semibold " +
                            (active ? "text-[#9d174d]" : "text-[#171717]")
                          }
                        >
                          {r.full_name}
                        </span>
                        <span className="mt-0.5 truncate font-mono text-[11px] text-[#888888]">
                          {r.patient_code}
                          {r.phone_primary ? ` · ${r.phone_primary}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* CHI TIẾT (phải) */}
        <aside className="w-full shrink-0 rounded-xl border border-[#f9a8d4] bg-[#fdf2f8] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:sticky lg:top-4 lg:w-[400px]">
          {!selected ? (
            <p className="py-10 text-center text-sm text-[#a1a1aa]">
              Chọn một khách hàng để xem chi tiết.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[#9d174d]">
                    {selected.full_name}
                  </h3>
                  <p className="font-mono text-xs text-[#888888]">
                    {selected.patient_code}
                  </p>
                </div>
                <button
                  onClick={() => setSel(null)}
                  aria-label="Bỏ chọn"
                  className="rounded-md p-1 text-[#9d174d] hover:bg-white/60 lg:hidden"
                >
                  <X size={16} />
                </button>
              </div>

              <dl className="space-y-1.5 text-sm">
                <Row label="Ngày sinh" value={selected.date_of_birth ? fmtDate(selected.date_of_birth) : null} />
                <Row label="Giới tính" value={selected.gender} />
                <Row label="SĐT chính" value={selected.phone_primary} />
                <Row label="SĐT người nhà" value={selected.phone_secondary} />
                <Row label="Dân tộc" value={selected.ethnicity} />
                <Row label="Quốc tịch" value={selected.nationality} />
                <Row label="Nghề nghiệp" value={selected.occupation} />
                <Row label="Đối tượng" value={selected.patient_objection} />
                <Row label="Địa chỉ" value={selected.address} />
                <Row label="Cơ sở" value={locName(selected.location_id)} />
                <Row label="Ngày tạo" value={fmtDateTimeOrDate(selected.created_at)} />
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/patients/${selected.clinic_patient_id}`}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#ec4899] px-4 text-sm font-semibold text-white hover:bg-[#db2777]"
                >
                  <ExternalLink size={14} /> Hồ sơ & lịch sử khám
                </Link>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-[#888888]">{label}</dt>
      <dd className="min-w-0 break-words text-[#171717]">{value || "—"}</dd>
    </div>
  );
}
