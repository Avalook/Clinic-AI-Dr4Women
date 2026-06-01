// Server component that runs the query. Receives searchParams from the page.

import Link from "next/link";
import { Inbox } from "lucide-react";
import { getSupabaseServer } from "../../../lib/supabase-server";

interface PatientRow {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  phone_primary: string | null;
  created_at: string;
}

// IMPORTANT: keep `national_id_number` out of this list (D-identity gate).
const SAFE_COLUMNS =
  "clinic_patient_id, patient_code, full_name, date_of_birth, phone_primary, created_at";

function ageFromDob(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return String(age);
}

const TH =
  "sticky top-0 z-10 border-b border-[#e4e4e7] bg-white px-4 py-2.5 font-medium";

const PAGE_SIZE = 50;

export default async function PatientsList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const supabase = await getSupabaseServer();

  const term = q.trim();
  const current = Math.max(1, Number.parseInt(page, 10) || 1);
  const from = (current - 1) * PAGE_SIZE;

  let query = supabase
    .from("patient")
    .select(SAFE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (term) {
    // OR over patient_code + full_name + phone_primary. PostgREST takes
    // a comma-joined ``or=`` filter; Supabase escapes the literal.
    query = query.or(
      `patient_code.ilike.%${term}%,` +
        `full_name.ilike.%${term}%,` +
        `phone_primary.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  const rows = (data as PatientRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Page link that preserves the active search term.
  const pageHref = (p: number): string => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/patients?${qs}` : "/patients";
  };

  return (
    <div className="space-y-3">
      <form className="flex gap-2" action="/patients" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm theo mã BN, tên, hoặc số điện thoại..."
          className="h-9 flex-1 rounded-md border border-[#e4e4e7] px-3 text-sm text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-[#ec4899] px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777]"
        >
          Tìm
        </button>
        {term && (
          <Link
            href="/patients"
            className="flex h-9 items-center rounded-md border border-[#e4e4e7] px-3.5 text-sm text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5]"
          >
            Xoá
          </Link>
        )}
      </form>

      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <table className="min-w-full divide-y divide-[#e4e4e7] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className={TH}>Code</th>
              <th className={TH}>Họ tên</th>
              <th className={TH}>DOB</th>
              <th className={TH}>Tuổi</th>
              <th className={TH}>SĐT</th>
              <th className={TH}>Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f4f5]">
            {rows.map((p) => (
              <tr
                key={p.clinic_patient_id}
                className="cursor-pointer transition-colors duration-150 hover:bg-[#f9fafb]"
              >
                <td className="px-4 py-2.5 font-mono text-xs">
                  <Link
                    href={`/patients/${p.clinic_patient_id}`}
                    className="text-[#ec4899] hover:underline"
                  >
                    {p.patient_code}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[#171717]">
                  <Link
                    href={`/patients/${p.clinic_patient_id}`}
                    className="text-[#ec4899] hover:underline"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[#4d4d4d]">
                  {p.date_of_birth ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[#4d4d4d]">
                  {ageFromDob(p.date_of_birth)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[#4d4d4d]">
                  {p.phone_primary ?? "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[#888888]">
                  {p.created_at.slice(0, 10)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#888888]">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span className="text-sm">
                      {term
                        ? `Không tìm thấy BN khớp "${term}".`
                        : "Chưa có BN."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-[#71717a]">
          <span>
            {rows.length > 0
              ? `${from + 1}–${from + rows.length} / ${total} bệnh nhân`
              : `${total} bệnh nhân`}
          </span>
          <div className="flex items-center gap-1">
            {current > 1 ? (
              <Link
                href={pageHref(current - 1)}
                className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5]"
              >
                ← Trước
              </Link>
            ) : (
              <span className="rounded-md border border-[#f4f4f5] px-3 py-1.5 text-[#d4d4d8]">
                ← Trước
              </span>
            )}
            <span className="px-2 text-[#4d4d4d]">
              Trang {current} / {totalPages}
            </span>
            {current < totalPages ? (
              <Link
                href={pageHref(current + 1)}
                className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5]"
              >
                Sau →
              </Link>
            ) : (
              <span className="rounded-md border border-[#f4f4f5] px-3 py-1.5 text-[#d4d4d8]">
                Sau →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
