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
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          Tìm
        </button>
        {term && (
          <Link
            href="/patients"
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Xoá
          </Link>
        )}
      </form>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">DOB</th>
              <th className="px-3 py-2">Tuổi</th>
              <th className="px-3 py-2">SĐT</th>
              <th className="px-3 py-2">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data as PatientRow[] | null)?.map((p) => (
              <tr key={p.clinic_patient_id}>
                <td className="px-3 py-2 font-mono text-xs">{p.patient_code}</td>
                <td className="px-3 py-2">{p.full_name}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.date_of_birth ?? "—"}
                </td>
                <td className="px-3 py-2">{ageFromDob(p.date_of_birth)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.phone_primary ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.created_at.slice(0, 10)}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
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
