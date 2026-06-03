"use client";

// "Công việc của tôi" cho BÁC SĨ: bảng 2 cột — Ngày (Hôm nay/Ngày mai/…) ×
// Thông tin bệnh nhân (lịch khám của bác sĩ ngày đó). Bấm tên BN → modal HỒ SƠ
// LÂM SÀNG (ClinicalRecordForm). Xác nhận/Từ chối lịch gộp ở đây (vì bác sĩ chỉ
// còn 2 nút sidebar). Bác sĩ chỉ thao tác lịch CỦA MÌNH.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, X, FileText } from "lucide-react";
import { fmtTimeOrNone } from "../../../lib/datetime";
import StatusBadge from "../StatusBadge";
import ClinicalRecordForm from "./ClinicalRecordForm";
import SplitPane from "../SplitPane";

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

  async function act(id: string, action: "confirm" | "decline" | "complete") {
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

  const boardEl = (
    <div className="h-full max-h-[78vh] overflow-auto rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
      <div className="sticky top-0 z-10 grid grid-cols-[7rem_1fr] border-b border-[#f3cfe0] bg-[#fce7f3] text-xs font-semibold uppercase tracking-wide text-[#9d2463]">
        <div className="px-3 py-2">Ngày</div>
        <div className="border-l border-[#f3cfe0] px-3 py-2">
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

                  {(a.status === "CONFIRMED" || a.status === "CHECKED_IN") && (
                    <div className="mt-2 flex gap-2 border-t border-[#f4f4f5] pt-2">
                      <button
                        onClick={() => act(a.id, "complete")}
                        disabled={busyId === a.id}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
                      >
                        <CheckCheck size={13} /> Khám xong
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
  );

  return (
    <>
      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {open ? (
        <>
          <p className="mb-2 text-[11px] text-[#c084a8]">
            ↔ Kéo thanh hồng ở GIỮA 2 bảng để chỉnh độ rộng (kéo trái: bảng trái
            co, hồ sơ rộng ra).
          </p>
          <SplitPane
            className="md:h-[78vh]"
            initialLeftPct={52}
            left={boardEl}
            right={
              <ClinicalRecordForm
                key={open.id}
                appt={open}
                staffId={staffId}
                fill
                onClose={() => setOpenId(null)}
              />
            }
          />
        </>
      ) : (
        boardEl
      )}
    </>
  );
}
