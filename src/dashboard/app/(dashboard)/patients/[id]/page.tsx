// Patient detail: admin info + appointment history + clinical history
// (visits/SOAP, lab results, pregnancy). The clinical history is the
// doctor's "bệnh án / tiền sử khám" view.
// SECURITY: national_id_number (CCCD) is intentionally NOT selected — D-identity.

import PatientDetail from "./PatientDetail";
import PatientHistory from "./PatientHistory";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Chi tiết BN</h1>
        <p className="text-sm text-gray-500">
          Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
        </p>
      </header>
      <PatientDetail id={id} />
      <PatientHistory id={id} />
    </div>
  );
}
