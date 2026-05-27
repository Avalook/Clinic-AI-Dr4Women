// Server component that runs the query. Receives searchParams from the page.

import Link from "next/link";
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

export default async function PatientsList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await getSupabaseServer();

  let query = supabase
    .from("patient")
    .select(SAFE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);

  const term = q.trim();
  if (term) {
    // OR over patient_code + full_name. Supabase escapes the value.
    query = query.or(`patient_code.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data, error } = await query;

  return (
    <div className="space-y-3">
      <form className="flex gap-2" action="/patients" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm theo patient_code hoặc tên..."
          className="h-9 flex-1 rounded-md border border-[#e4e4e7] px-3 text-sm text-[#171717] outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-[#6366f1] px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
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
          <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Họ tên</th>
              <th className="px-4 py-2.5 font-medium">DOB</th>
              <th className="px-4 py-2.5 font-medium">Tuổi</th>
              <th className="px-4 py-2.5 font-medium">SĐT</th>
              <th className="px-4 py-2.5 font-medium">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f4f5]">
            {(data as PatientRow[] | null)?.map((p) => (
              <tr
                key={p.clinic_patient_id}
                className="transition-colors duration-150 hover:bg-[#f9fafb]"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-[#6366f1]">
                  {p.patient_code}
                </td>
                <td className="px-4 py-2.5 text-[#171717]">
                  <Link
                    href={`/patients/${p.clinic_patient_id}`}
                    className="text-[#6366f1] hover:underline"
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
            {(!data || data.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-[#888888]"
                >
                  {term ? `Không tìm thấy BN khớp "${term}".` : "Chưa có BN."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
