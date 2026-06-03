"use client";

// "Công việc của tôi" cho BÁC SĨ: bảng 2 cột — Ngày (Hôm nay/Ngày mai/…) ×
// Thông tin bệnh nhân (lịch khám của bác sĩ ngày đó). Bấm tên BN → modal HỒ SƠ
// LÂM SÀNG (ClinicalRecordForm). Xác nhận/Từ chối lịch gộp ở đây (vì bác sĩ chỉ
// còn 2 nút sidebar). Bác sĩ chỉ thao tác lịch CỦA MÌNH.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, FileText } from "lucide-react";
import { fmtTimeOrNone } from "../../../lib/datetime";
import StatusBadge from "../StatusBadge";
import ClinicalRecordForm from "./ClinicalRecordForm";

export interface DoctorApptRow {
  id: string;
  slot_start: string;
  status: string;
  patient: {
    clinic_patient_id: string;
    patient_code: string;
    full_name: string;
    date_of_birth: string | null;
    national_id_number: string | null;
    phone_primary: string | null;
    phone_secondary: string | null;
    gender: string | null;
    ethnicity: string | null;
    nationality: string | null;
    occupation: string | null;
    patient_objection: string | null;
    address: string | null;
    guardian_name: string | null;
  } | null;
  service: { name: string } | null;
}

export interface DoctorDay {
  label: string;
  items: DoctorApptRow[];
}

export default function DoctorWorkBoard({
  days,
  staffId,
}: {
  days: DoctorDay[];
  staffId: string | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = days.flatMap((d) => d.items).find((a) => a.id === openId) ?? null;

  async function act(id: string, action: "confirm" | "decline") {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json()).error ?? "Lỗi thao tác.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-[7rem_1fr] border-b border-[#e4e4e7] bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-[#71717a]">
          <div className="px-3 py-2">Ngày</div>
          <div className="border-l border-[#e4e4e7] px-3 py-2">
            Thông tin bệnh nhân
          </div>
        </div>

        {days.map((day) => (
          <div
            key={day.label}
            className="grid grid-cols-[7rem_1fr] border-b border-[#e4e4e7] last:border-b-0"
          >
            <div className="px-3 py-3 text-sm font-semibold text-[#171717]">
              {day.label}
              <span className="ml-1 text-xs font-normal text-[#a1a1aa]">
                ({day.items.length})
              </span>
            </div>
            <div className="space-y-2 border-l border-[#e4e4e7] p-2">
              {day.items.length === 0 && (
                <p className="py-3 text-center text-xs text-[#a1a1aa]">
                  Không có lịch
                </p>
              )}
              {day.items.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-[#e4e4e7] bg-white p-2.5"
                >
                  <button
                    onClick={() => setOpenId(a.id)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <FileText size={15} className="mt-0.5 shrink-0 text-[#ec4899]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#171717]">
                        {a.patient?.full_name ?? "—"}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#888888]">
                        {a.patient?.patient_code}
                        {a.patient?.phone_primary
                          ? ` · ${a.patient.phone_primary}`
                          : ""}
                      </span>
                      <span className="mt-1 block text-xs text-[#52525b]">
                        {fmtTimeOrNone(a.slot_start)}
                        {a.service?.name ? ` · ${a.service.name}` : ""}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                  </button>

                  {a.status === "SCHEDULED" && (
                    <div className="mt-2 flex gap-2 border-t border-[#f4f4f5] pt-2">
                      <button
                        onClick={() => act(a.id, "confirm")}
                        disabled={busyId === a.id}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#16a34a] px-3 text-xs font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                      >
                        <Check size={13} /> Xác nhận
                      </button>
                      <button
                        onClick={() => act(a.id, "decline")}
                        disabled={busyId === a.id}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#e4e4e7] bg-white px-3 text-xs font-medium text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
                      >
                        <X size={13} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="my-6 w-full max-w-3xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ClinicalRecordForm
              appt={open}
              staffId={staffId}
              onClose={() => setOpenId(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
