"use client";

// "Công việc của tôi" cho BÁC SĨ — KANBAN theo TRẠNG THÁI (feedback C2):
//   Chờ xác nhận · Đã xác nhận/Đã đến · Đã khám xong · Từ chối/Hủy.
// Mỗi thẻ = 1 lịch của bác sĩ. Bấm tên BN → hồ sơ lâm sàng (ClinicalRecordForm)
// ở cột PHẢI (SplitPane). Nút trên thẻ: Nhận khám / Từ chối (lịch mới). KHÔNG còn
// nút "Khám xong" thủ công — bác sĩ điền hồ sơ (Chẩn đoán + Lời dặn) rồi Lưu thì
// lịch TỰ chuyển COMPLETED (xem ClinicalRecordForm.willComplete). Yêu cầu: chỉ khi
// lễ tân đã check-in (BN đã đến) bác sĩ mới điền được hồ sơ.
// Badge Khám lần đầu / Tái khám (feedback C3).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, FileText } from "lucide-react";
import { fmtDayTime } from "../../../lib/datetime";
import { compareQueue } from "../../../lib/queue";
import StatusBadge from "../StatusBadge";
import ClinicalRecordForm from "./ClinicalRecordForm";
import SplitPane from "../SplitPane";

export interface DoctorApptRow {
  id: string;
  slot_start: string;
  status: string;
  /** Số thứ tự khám (queue_number) — lễ tân cấp khi check-in. */
  queue_number?: string | null;
  /** "Khám lần đầu" | "Tái khám" | "" — suy từ lịch sử hẹn (server tính sẵn). */
  phan_loai?: string;
  patient: {
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
    guardian_name: string | null;
  } | null;
  service: { name: string } | null;
}

const COLUMNS = [
  {
    key: "pending",
    label: "Chờ xác nhận",
    // Gồm lịch CSKH đã xác nhận với khách (CSKH_CONFIRMED) — vẫn chờ bác sĩ nhận ca.
    statuses: ["SCHEDULED", "CSKH_CONFIRMED"],
    dot: "#2563eb",
  },
  {
    key: "confirmed",
    label: "Đã xác nhận / Đã đến",
    statuses: ["CONFIRMED", "CHECKED_IN"],
    dot: "#16a34a",
  },
  { key: "done", label: "Đã khám xong", statuses: ["COMPLETED"], dot: "#71717a" },
  {
    key: "off",
    label: "Từ chối / Hủy",
    statuses: ["DOCTOR_DECLINED", "CANCELLED", "NO_SHOW"],
    dot: "#dc2626",
  },
];

function PhanLoai({ value }: { value?: string }) {
  if (!value) return null;
  const first = value === "Khám lần đầu";
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium " +
        (first ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef3c7] text-[#b45309]")
      }
    >
      {value}
    </span>
  );
}

export default function DoctorWorkBoard({
  rows,
  staffId,
}: {
  rows: DoctorApptRow[];
  staffId: string | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = rows.find((a) => a.id === openId) ?? null;

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

  const boardEl = (
    <div className="h-full max-h-[78vh] overflow-auto rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
      <div className="flex min-h-full divide-x divide-[#f6e0ec]">
        {COLUMNS.map((col) => {
          const items = rows
            .filter((r) => col.statuses.includes(r.status))
            .sort(compareQueue);
          return (
            <div key={col.key} className="flex min-w-[220px] flex-1 flex-col">
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#f3cfe0] bg-[#fce7f3] px-3 py-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: col.dot }}
                />
                <span className="text-sm font-semibold text-[#171717]">
                  {col.label}
                </span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-[#71717a]">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 p-2">
                {items.length === 0 && (
                  <p className="py-6 text-center text-xs text-[#a1a1aa]">Trống</p>
                )}
                {items.map((a) => (
                  <div
                    key={a.id}
                    className={
                      "rounded-lg border bg-white p-2.5 transition-colors " +
                      (openId === a.id
                        ? "border-[#ec4899] ring-2 ring-[#ec4899]/20"
                        : "border-[#e4e4e7] hover:border-[#ec4899]/50")
                    }
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
                          {a.queue_number ? `Số ${a.queue_number} · ` : ""}
                          {fmtDayTime(a.slot_start)}
                          {a.service?.name ? ` · ${a.service.name}` : ""}
                        </span>
                      </span>
                    </button>

                    {(a.phan_loai ||
                      col.key === "off" ||
                      a.status === "CSKH_CONFIRMED") && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <PhanLoai value={a.phan_loai} />
                        {a.status === "CSKH_CONFIRMED" && (
                          <span className="inline-block rounded-full bg-[#ccfbf1] px-2 py-0.5 text-[10px] font-medium text-[#0f766e]">
                            CSKH đã xác nhận
                          </span>
                        )}
                        {col.key === "off" && <StatusBadge status={a.status} />}
                      </div>
                    )}

                    {(a.status === "SCHEDULED" ||
                      a.status === "CSKH_CONFIRMED") && (
                      <div className="mt-2 flex gap-2 border-t border-[#f4f4f5] pt-2">
                        <button
                          onClick={() => act(a.id, "confirm")}
                          disabled={busyId === a.id}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#16a34a] px-3 text-xs font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                        >
                          <Check size={13} /> Nhận khám
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

                    {/* "Khám xong" giờ TỰ ĐỘNG: bác sĩ mở hồ sơ, điền Chẩn đoán +
                        Lời dặn rồi Lưu → hệ thống tự chuyển COMPLETED. Bỏ nút thủ công. */}
                    {a.status === "CHECKED_IN" && (
                      <p className="mt-2 border-t border-[#f4f4f5] pt-2 text-[11px] text-[#7c3aed]">
                        Mở hồ sơ → điền Chẩn đoán + Lời dặn rồi Lưu để tự động Khám xong.
                      </p>
                    )}
                    {a.status === "CONFIRMED" && (
                      <p className="mt-2 border-t border-[#f4f4f5] pt-2 text-[11px] text-[#a1a1aa]">
                        Chờ lễ tân check-in (bệnh nhân đến) mới khám được.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
