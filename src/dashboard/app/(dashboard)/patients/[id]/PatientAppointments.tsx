"use client";

// Danh sách lịch hẹn của MỘT khách trên trang Hồ sơ bệnh nhân, kèm thao tác
// Đổi lịch / Hủy (CSKH / Quản lý / Trưởng ca). Dùng lại PATCH /api/appointments
// (action "reschedule" / "cancel") — CÙNG luật & gác quyền như board
// "Tình trạng lịch hẹn" (/tasks), chỉ khác là hiển thị theo từng khách để CSKH
// sửa/hủy ngay chỗ đặt lịch cho khách.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock } from "lucide-react";
import {
  fmtDateTimeOrDate,
  vnLocalToUtcISO,
  nowMs,
} from "../../../../lib/datetime";
import {
  todayVn,
  clinicHoursForDate,
  clinicHoursError,
} from "../../../../lib/roster";
import { INPUT, LABEL } from "../../form-ui";
import Time24Input from "../../Time24Input";
import StatusBadge from "../../StatusBadge";

export interface Opt {
  id: string;
  label: string;
}

export interface ApptRow {
  id: string;
  slot_start: string;
  status: string;
  cancellation_reason?: string | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

// Lịch còn "sống" → đổi / hủy được (khớp ConfirmBoard).
const LIVE = ["SCHEDULED", "CSKH_CONFIRMED", "CONFIRMED", "CHECKED_IN"];

export default function PatientAppointments({
  appointments,
  doctors = [],
  canManage = false,
}: {
  appointments: ApptRow[];
  /** Bác sĩ để đổi/phân lại (chỉ cần khi canManage). */
  doctors?: Opt[];
  /** CSKH / Quản lý / Trưởng ca: được Đổi lịch + Hủy lịch. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"resched" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Đổi lịch
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("");
  const [rDoc, setRDoc] = useState("");
  // Hủy
  const [reason, setReason] = useState("");

  // Giới hạn giờ đổi lịch theo giờ mở cửa của ngày mới.
  const rCh = rDate ? clinicHoursForDate(rDate) : null;
  const rMinHour = rCh ? Number(rCh.open.slice(0, 2)) : 0;
  const rMaxHour = rCh ? Number(rCh.close.slice(0, 2)) - 1 : 23;

  function openPanel(id: string, m: "resched" | "cancel") {
    if (openId === id && mode === m) {
      setOpenId(null);
      setMode(null);
      return;
    }
    setOpenId(id);
    setMode(m);
    setError(null);
    setRDate("");
    setRTime("");
    setRDoc("");
    setReason("");
  }

  function closePanel() {
    setOpenId(null);
    setMode(null);
    setError(null);
  }

  async function patch(
    id: string,
    payload: Record<string, unknown>,
    errMsg: string,
  ) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? errMsg);
      return;
    }
    closePanel();
    router.refresh();
  }

  async function doReschedule(id: string) {
    if (!rDate || !rTime) {
      setError("Chọn ngày và giờ mới.");
      return;
    }
    const start = new Date(vnLocalToUtcISO(rDate, rTime));
    if (start.getTime() < nowMs()) {
      setError("Không thể đổi sang ngày/giờ trong quá khứ.");
      return;
    }
    const chErr = clinicHoursError(rDate, rTime);
    if (chErr) {
      setError(chErr);
      return;
    }
    const end = new Date(start.getTime() + 30 * 60_000);
    const payload: Record<string, unknown> = {
      action: "reschedule",
      slot_start: start.toISOString(),
      slot_end: end.toISOString(),
    };
    if (rDoc) payload.doctor_id = rDoc; // rỗng = giữ bác sĩ hiện tại
    await patch(id, payload, "Lỗi đổi lịch.");
  }

  async function doCancel(id: string) {
    await patch(
      id,
      { action: "cancel", cancellation_reason: reason },
      "Lỗi hủy lịch.",
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-[#171717]">
        Lịch hẹn của khách ({appointments.length})
      </h3>

      {appointments.length === 0 ? (
        <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-6 text-center text-sm text-[#888888]">
          Chưa có lịch hẹn nào.
        </div>
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => {
            const live = LIVE.includes(a.status);
            const isOpen = openId === a.id;
            return (
              <li
                key={a.id}
                className="rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#171717]">
                      {fmtDateTimeOrDate(a.slot_start)}
                    </p>
                    <p className="text-xs text-[#71717a]">
                      {a.service?.name ?? "—"} ·{" "}
                      {a.doctor?.full_name ?? "Chưa phân bác sĩ"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {canManage && live && (
                      <>
                        <button
                          onClick={() => openPanel(a.id, "resched")}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#bfdbfe] bg-white px-3 text-xs font-medium text-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-50"
                        >
                          <CalendarClock size={13} /> Đổi lịch
                        </button>
                        <button
                          onClick={() => openPanel(a.id, "cancel")}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#fecaca] bg-white px-3 text-xs font-medium text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
                        >
                          <Ban size={13} /> Hủy
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {a.status === "CANCELLED" && a.cancellation_reason && (
                  <p className="mt-1.5 text-xs text-[#dc2626]">
                    Lý do hủy: {a.cancellation_reason}
                  </p>
                )}

                {/* Đổi lịch (CSKH/QL) */}
                {isOpen && mode === "resched" && (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#bfdbfe] bg-[#f8fbff] p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={LABEL}>Ngày mới</label>
                        <input
                          type="date"
                          min={todayVn()}
                          className={INPUT}
                          value={rDate}
                          onChange={(e) => setRDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Giờ mới</label>
                        <Time24Input
                          value={rTime}
                          onChange={setRTime}
                          minHour={rMinHour}
                          maxHour={rMaxHour}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Bác sĩ (tuỳ chọn)</label>
                      <select
                        className={INPUT}
                        value={rDoc}
                        onChange={(e) => setRDoc(e.target.value)}
                      >
                        <option value="">— Giữ bác sĩ hiện tại —</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => doReschedule(a.id)}
                        disabled={busy}
                        className="min-h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                      >
                        {busy ? "Đang đổi…" : "Xác nhận đổi lịch"}
                      </button>
                      <button
                        onClick={closePanel}
                        disabled={busy}
                        className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-50"
                      >
                        Thôi
                      </button>
                    </div>
                  </div>
                )}

                {/* Hủy lịch (CSKH/QL) */}
                {isOpen && mode === "cancel" && (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#fecaca] bg-[#fff7f7] p-3">
                    <label className={LABEL}>Lý do hủy (tuỳ chọn)</label>
                    <input
                      className={INPUT}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="VD: khách bận, đổi lịch…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => doCancel(a.id)}
                        disabled={busy}
                        className="min-h-10 rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50"
                      >
                        {busy ? "Đang hủy…" : "Xác nhận hủy"}
                      </button>
                      <button
                        onClick={closePanel}
                        disabled={busy}
                        className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-50"
                      >
                        Thôi
                      </button>
                    </div>
                  </div>
                )}

                {isOpen && error && (
                  <p className="mt-2 text-xs text-[#dc2626]">{error}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
