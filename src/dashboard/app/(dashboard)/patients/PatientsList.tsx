// Server component that runs the query. Receives searchParams from the page.

import Link from "next/link";
import { Inbox } from "lucide-react";
import { getSupabaseServer } from "../../../lib/supabase-server";

interface PatientRow {
  clinic_patient_id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  birth_year?: number | null;
  phone_primary: string | null;
  created_at: string;
}

// IMPORTANT: keep `national_id_number` out of this list (D-identity gate).
const SAFE_COLUMNS =
  "clinic_patient_id, patient_code, full_name, date_of_birth, phone_primary, created_at";
// birth_year cần migration 040; nếu chưa apply → query lỗi → fallback SAFE_COLUMNS.
const FULL_COLUMNS = SAFE_COLUMNS + ", birth_year";

// Bỏ dấu + thường (khớp cột patient.full_name_unaccent của migration 039).
function unaccentVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function ageFromDob(dob: string | null, birthYear?: number | null): string {
  if (!dob && birthYear) return String(new Date().getFullYear() - birthYear);
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return String(age);
}

// Ngày sinh hiển thị: năm-only (birth_year) → "1990"; else ngày sinh thật.
function dobLabel(p: PatientRow): string {
  if (p.birth_year) return String(p.birth_year);
  return p.date_of_birth ?? "—";
}

const TH =
  "sticky top-0 z-10 border-b border-[#e4e4e7] bg-white px-4 py-2.5 font-medium";

const PAGE_SIZE = 50;

export default async function PatientsList({
  searchParams,
  doctorId = null,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
  /** Khi set (bác sĩ): chỉ liệt kê BN của bác sĩ này (qua RPC). */
  doctorId?: string | null;
}) {
  const { q = "", page = "1" } = await searchParams;
  const supabase = await getSupabaseServer();

  const term = q.trim();
  const current = Math.max(1, Number.parseInt(page, 10) || 1);
  const from = (current - 1) * PAGE_SIZE;

  let rows: PatientRow[] = [];
  let total = 0;
  let error: { message: string } | null = null;

  if (doctorId) {
    // Bác sĩ → chỉ BN của mình (lọc + tìm + phân trang phía DB).
    const { data, error: rpcErr } = await supabase.rpc("doctor_patient_list", {
      p_doctor_id: doctorId,
      p_term: term,
      p_limit: PAGE_SIZE,
      p_offset: from,
    });
    const list = (data as (PatientRow & { total_count: number })[] | null) ?? [];
    rows = list.map((r) => ({
      clinic_patient_id: r.clinic_patient_id,
      patient_code: r.patient_code,
      full_name: r.full_name,
      date_of_birth: r.date_of_birth,
      phone_primary: r.phone_primary,
      created_at: r.created_at,
    }));
    total = list.length > 0 ? Number(list[0].total_count) : 0;
    error = rpcErr;
  } else {
    // useUnaccent=true → thêm cột full_name_unaccent (migration 039). Nếu chưa có
    // cột (chưa chạy migration) → query lỗi → fallback không bỏ dấu.
    const run = (cols: string, useUnaccent: boolean) => {
      let query = supabase
        .from("patient")
        .select(cols, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (term) {
        const ors = [
          `patient_code.ilike.%${term}%`,
          `full_name.ilike.%${term}%`,
          `phone_primary.ilike.%${term}%`,
        ];
        if (useUnaccent) {
          ors.push(`full_name_unaccent.ilike.%${unaccentVi(term)}%`);
        }
        query = query.or(ors.join(","));
      }
      return query;
    };
    let { data, error: qErr, count } = await run(FULL_COLUMNS, true);
    // Thiếu cột (birth_year / full_name_unaccent chưa migrate) → fallback an toàn.
    if (qErr && /full_name_unaccent|birth_year|column/i.test(qErr.message ?? "")) {
      ({ data, error: qErr, count } = await run(SAFE_COLUMNS, false));
    }
    rows = (data as PatientRow[] | null) ?? [];
    total = count ?? 0;
    error = qErr;
  }

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
      <form
        className="flex flex-wrap items-center gap-2"
        action="/patients"
        method="GET"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm mã BN, tên, hoặc SĐT..."
          className="h-11 min-w-0 flex-1 basis-full rounded-md border border-[#e4e4e7] px-3 text-base text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20 sm:h-9 sm:basis-auto sm:text-sm"
        />
        <button
          type="submit"
          className="h-11 rounded-md bg-[#ec4899] px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] active:bg-[#db2777] sm:h-9"
        >
          Tìm
        </button>
        {term && (
          <Link
            href="/patients"
            className="flex h-11 items-center rounded-md border border-[#e4e4e7] px-3.5 text-sm text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5] active:bg-[#f4f4f5] sm:h-9"
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

      {/* Mobile: card list (<md). */}
      <div className="space-y-2 md:hidden">
        {rows.map((p) => (
          <Link
            key={p.clinic_patient_id}
            href={`/patients/${p.clinic_patient_id}`}
            className="block rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:bg-[#f9fafb]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-[#171717]">{p.full_name}</span>
              <span className="font-mono text-xs text-[#ec4899]">
                {p.patient_code}
              </span>
            </div>
            <dl className="mt-1.5 grid grid-cols-3 gap-1 text-xs text-[#4d4d4d]">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#888888]">
                  DOB
                </dt>
                <dd className="font-mono">{dobLabel(p)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#888888]">
                  Tuổi
                </dt>
                <dd>{ageFromDob(p.date_of_birth, p.birth_year)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#888888]">
                  SĐT
                </dt>
                <dd className="font-mono">{p.phone_primary ?? "—"}</dd>
              </div>
            </dl>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-4 py-8 text-[#888888]">
            <Inbox size={28} strokeWidth={1.5} />
            <span className="text-sm">
              {term ? `Không tìm thấy BN khớp "${term}".` : "Chưa có BN."}
            </span>
          </div>
        )}
      </div>

      {/* Desktop: table (≥md). */}
      <div className="hidden resize overflow-auto rounded-lg border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)] max-h-[88vh] min-h-[180px] md:block">
        <table className="min-w-full divide-y divide-[#f6e0ec] text-sm">
          <thead className="bg-[#fce7f3] text-left text-[11px] font-semibold uppercase tracking-wide text-[#9d2463]">
            <tr>
              <th className={TH}>Code</th>
              <th className={TH}>Họ tên</th>
              <th className={TH}>DOB</th>
              <th className={TH}>Tuổi</th>
              <th className={TH}>SĐT</th>
              <th className={TH}>Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f6e0ec]">
            {rows.map((p) => (
              <tr
                key={p.clinic_patient_id}
                className="cursor-pointer transition-colors duration-150 hover:bg-[#fdf2f8]"
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
                  {dobLabel(p)}
                </td>
                <td className="px-4 py-2.5 text-[#4d4d4d]">
                  {ageFromDob(p.date_of_birth, p.birth_year)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#71717a]">
          <span>
            {rows.length > 0
              ? `${from + 1}–${from + rows.length} / ${total} bệnh nhân`
              : `${total} bệnh nhân`}
          </span>
          <div className="flex items-center gap-1">
            {current > 1 ? (
              <Link
                href={pageHref(current - 1)}
                className="rounded-md border border-[#e4e4e7] px-3 py-2 text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5] active:bg-[#f4f4f5] sm:py-1.5"
              >
                ← Trước
              </Link>
            ) : (
              <span className="rounded-md border border-[#f4f4f5] px-3 py-2 text-[#d4d4d8] sm:py-1.5">
                ← Trước
              </span>
            )}
            <span className="px-2 text-[#4d4d4d]">
              Trang {current} / {totalPages}
            </span>
            {current < totalPages ? (
              <Link
                href={pageHref(current + 1)}
                className="rounded-md border border-[#e4e4e7] px-3 py-2 text-[#4d4d4d] transition-colors duration-150 hover:bg-[#f4f4f5] active:bg-[#f4f4f5] sm:py-1.5"
              >
                Sau →
              </Link>
            ) : (
              <span className="rounded-md border border-[#f4f4f5] px-3 py-2 text-[#d4d4d8] sm:py-1.5">
                Sau →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
