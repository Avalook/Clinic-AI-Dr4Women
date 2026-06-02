"use client";

// "Đặt lịch hẹn" entry point on an existing patient's profile. Collapsed to a
// button by default; expands the shared <AppointmentBooking> form for this
// patient. On success it refreshes the route so the appointment-history table
// in <PatientDetail> picks up the new booking. Only rendered for intake roles
// (gated server-side in page.tsx via canWriteIntake).

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppointmentBooking, { type Option } from "../AppointmentBooking";

const BTN =
  "min-h-11 w-full rounded-md bg-[#ec4899] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2";
const CARD =
  "rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]";

export default function PatientBooking({
  clinicPatientId,
  services,
  doctors,
  locations,
}: {
  clinicPatientId: string;
  services: Option[];
  doctors: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bookedId, setBookedId] = useState<string | null>(null);

  if (bookedId) {
    return (
      <section className={`${CARD} space-y-3`}>
        <p className="rounded bg-[#dcfce7] px-3 py-2 text-sm text-[#15803d]">
          ✓ Đã đặt lịch hẹn.
        </p>
        <button
          onClick={() => {
            setBookedId(null);
            setOpen(true);
          }}
          className={BTN}
        >
          Đặt lịch khác
        </button>
      </section>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={BTN}>
        + Đặt lịch hẹn
      </button>
    );
  }

  return (
    <section className={`${CARD} space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#171717]">Đặt lịch hẹn</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-[#71717a] hover:underline"
        >
          Đóng
        </button>
      </div>
      <AppointmentBooking
        clinicPatientId={clinicPatientId}
        services={services}
        doctors={doctors}
        locations={locations}
        onBooked={(id) => {
          setBookedId(id);
          router.refresh();
        }}
      />
    </section>
  );
}
