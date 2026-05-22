// Read-only patient list with a search box on patient_code / full_name.
// SECURITY: national_id_number (CCCD) is intentionally NOT selected — D-identity.

import PatientsList from "./PatientsList";

export const dynamic = "force-dynamic";

export default function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Patients</h1>
        <p className="text-sm text-gray-500">
          Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
        </p>
      </header>
      <PatientsList searchParams={searchParams} />
    </div>
  );
}
