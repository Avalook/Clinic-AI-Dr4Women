"use client";

// CSKH "Tình trạng lịch hẹn": MỘT bảng (các cột trạng thái chung trong 1 khung)
// bên trái; click tên KH → panel "Thông tin khách hàng" hiện BÊN CẠNH (ngang).
// Panel có 2 nút: Xác nhận (cskh_confirm) / Không xác nhận → sửa tại chỗ.
// CCCD KHÔNG hiển thị/sửa (D-identity).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X, Ban, CalendarClock } from "lucide-react";
import { fmtTimeOrNone, vnLocalToUtcISO, nowMs } from "../../../lib/datetime";
import { todayVn, clinicHoursForDate, clinicHoursError } from "../../../lib/roster";
import { digitsOnly, phoneError } from "../../../lib/validation";
import { INPUT, LABEL } from "../form-ui";
import Time24Input from "../Time24Input";
import StatusBadge from "../StatusBadge";

export interface Opt {
  id: string;
  label: string;
}

export interface ApptRow {
  id: string;
  slot_start: string;
  status: string;
  booking_channel: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  patient: {
    clinic_patient_id: string;
    full_name: string;
    patient_code: string;
    phone_primary: string | null;
    phone_secondary: string | null;
    date_of_birth: string | null;
    location_id: string | null;
    gender: string | null;
    ethnicity: string | null;
    nationality: string | null;
    occupation: string | null;
    patient_objection: string | null;
    address: string | null;
    guardian_name: string | null;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

// Board "Tình trạng lịch hẹn" — 4 cột theo appointment.status, 1 lịch ở 1 cột:
// Chờ xác nhận → Đã xác nhận → Đã khám xong → Đã huỷ / Từ chối. Cột cuối để CSKH
// THẤY lịch bác sĩ TỪ CHỐI (DOCTOR_DECLINED) + hủy + không đến (trước đây tàng hình).
const COLUMNS = [
  { key: "pending", label: "Chờ xác nhận", statuses: ["SCHEDULED"], dot: "#2563eb" },
  {
    key: "confirmed",
    label: "Đã xác nhận",
    // CSKH_CONFIRMED = CSKH đã xác nhận với khách (chờ bác sĩ nhận ca);
    // CONFIRMED = bác sĩ đã nhận ca; CHECKED_IN = khách đã đến.
    statuses: ["CSKH_CONFIRMED", "CONFIRMED", "CHECKED_IN"],
    dot: "#16a34a",
  },
  { key: "done", label: "Đã khám xong", statuses: ["COMPLETED"], dot: "#71717a" },
  {
    key: "off",
    label: "Đã huỷ / Từ chối",
    statuses: ["CANCELLED", "DOCTOR_DECLINED", "NO_SHOW"],
    dot: "#dc2626",
  },
];

interface Form {
  full_name: string;
  date_of_birth: string;
  phone_primary: string;
  phone_secondary: string;
  location_id: string;
  gender: string;
  ethnicity: string;
  nationality: string;
  occupation: string;
  patient_objection: string;
  address: string;
  guardian_name: string;
}

export default function ConfirmBoard({
  rows,
  locations,
  doctors = [],
  canManage = false,
}: {
  rows: ApptRow[];
  locations: Opt[];
  /** Bác sĩ để PHÂN LẠI lịch bị từ chối (chỉ cần khi canManage). */
  doctors?: Opt[];
  /** CSKH/Quản lý: được Hủy lịch + Phân lại bác sĩ. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Đổi lịch (theo yêu cầu khách): ngày/giờ mới + tuỳ chọn đổi bác sĩ.
  const [showResched, setShowResched] = useState(false);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");
  const [reschedDoc, setReschedDoc] = useState("");

  const sel = rows.find((r) => r.id === selId) ?? null;
  const locName = (id: string | null) =>
    locations.find((l) => l.id === id)?.label ?? "—";
  // Còn "sống" → hủy / đổi lịch được (gồm CSKH đã xác nhận, chờ bác sĩ).
  const LIVE = ["SCHEDULED", "CSKH_CONFIRMED", "CONFIRMED", "CHECKED_IN"];
  // Giới hạn giờ đổi lịch theo giờ mở cửa của ngày mới.
  const rCh = reschedDate ? clinicHoursForDate(reschedDate) : null;
  const rMinHour = rCh ? Number(rCh.open.slice(0, 2)) : 0;
  const rMaxHour = rCh ? Number(rCh.close.slice(0, 2)) - 1 : 23;

  function select(a: ApptRow) {
    setSelId(a.id);
    setEditing(false);
    setError(null);
    setShowCancel(false);
    setCancelReason("");
    setShowResched(false);
    setReschedDate("");
    setReschedTime("");
    setReschedDoc("");
  }
  function close() {
    setSelId(null);
    setEditing(false);
    setError(null);
    setShowCancel(false);
    setShowResched(false);
  }

  function startEdit() {
    if (!sel?.patient) return;
    const p = sel.patient;
    setForm({
      full_name: p.full_name ?? "",
      date_of_birth: p.date_of_birth ?? "",
      phone_primary: p.phone_primary ?? "",
      phone_secondary: p.phone_secondary ?? "",
      location_id: p.location_id ?? locations[0]?.id ?? "",
      gender: p.gender ?? "",
      ethnicity: p.ethnicity ?? "",
      nationality: p.nationality ?? "",
      occupation: p.occupation ?? "",
      patient_objection: p.patient_objection ?? "",
      address: p.address ?? "",
      guardian_name: p.guardian_name ?? "",
    });
    setEditing(true);
    setError(null);
  }

  async function patchAppt(payload: Record<string, unknown>, errMsg: string) {
    if (!sel) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sel.id, ...payload }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? errMsg);
      return;
    }
    setShowCancel(false);
    setShowResched(false);
    router.refresh();
  }

  async function confirm() {
    await patchAppt({ action: "cskh_confirm" }, "Lỗi xác nhận.");
  }
  async function cancelAppt() {
    await patchAppt(
      { action: "cancel", cancellation_reason: cancelReason },
      "Lỗi hủy lịch.",
    );
  }
  async function reschedule() {
    if (!reschedDate || !reschedTime) {
      setError("Chọn ngày và giờ mới.");
      return;
    }
    const start = new Date(vnLocalToUtcISO(reschedDate, reschedTime));
    if (start.getTime() < nowMs()) {
      setError("Không thể đổi sang ngày/giờ trong quá khứ.");
      return;
    }
    const chErr = clinicHoursError(reschedDate, reschedTime);
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
    if (reschedDoc) payload.doctor_id = reschedDoc; // rỗng = giữ bác sĩ hiện tại
    await patchAppt(payload, "Lỗi đổi lịch.");
  }

  async function save() {
    if (!sel || !form) return;
    const ve = phoneError(form.phone_primary) || phoneError(form.phone_secondary);
    if (ve) return setError(ve);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_patient_id: sel.patient?.clinic_patient_id,
        ...form,
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Lỗi lưu.");
    setEditing(false);
    router.refresh();
  }

  const set = (k: keyof Form, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* MỘT bảng — các cột trạng thái chung trong 1 khung */}
      <div className="flex h-[520px] min-h-0 min-w-0 max-h-[88vh] flex-1 resize-y flex-col overflow-hidden rounded-xl border border-[#f3cfe0] bg-white shadow-[0_1px_3px_rgba(236,72,153,0.08)]">
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-x divide-[#f6e0ec] sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = rows.filter((r) => col.statuses.includes(r.status));
            return (
              <div key={col.key} className="flex min-h-0 min-w-0 flex-col">
                <div className="flex items-center gap-2 border-b border-[#f3cfe0] bg-[#fce7f3] px-3 py-2">
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
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {items.length === 0 && (
                    <p className="py-6 text-center text-xs text-[#a1a1aa]">
                      Trống
                    </p>
                  )}
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => select(a)}
                      className={
                        "w-full rounded-lg border bg-white p-2.5 text-left transition-colors " +
                        (selId === a.id
                          ? "border-[#ec4899] ring-2 ring-[#ec4899]/20"
                          : "border-[#e4e4e7] hover:border-[#ec4899]/50")
                      }
                    >
                      <span className="block truncate text-sm font-medium text-[#171717]">
                        {a.patient?.full_name ?? "—"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-[#888888]">
                        {a.patient?.patient_code}
                        {a.patient?.phone_primary
                          ? ` · ${a.patient.phone_primary}`
                          : ""}
                      </span>
                      <span className="mt-1 block text-xs text-[#52525b]">
                        {fmtTimeOrNone(a.slot_start)}
                        {a.service?.name ? ` · ${a.service.name}` : ""}
                      </span>
                      {col.key === "off" && (
                        <span className="mt-1.5 block">
                          <StatusBadge status={a.status} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel chi tiết — BÊN CẠNH bảng (ngang); mobile thì xuống dưới */}
      {sel && (
        <aside className="w-full shrink-0 overflow-y-auto rounded-xl border border-[#f9a8d4] bg-[#fdf2f8] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-[360px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#9d174d]">
              Thông tin khách hàng
            </h3>
            <button
              onClick={close}
              aria-label="Đóng"
              className="rounded-md p-1 text-[#9d174d] hover:bg-white/60"
            >
              <X size={16} />
            </button>
          </div>

          {!editing ? (
            <>
              <dl className="space-y-1.5 text-sm">
                <Row label="Họ tên" value={sel.patient?.full_name} />
                <Row label="Ngày sinh" value={sel.patient?.date_of_birth} />
                <Row label="Giới tính" value={sel.patient?.gender} />
                <Row label="SĐT chính" value={sel.patient?.phone_primary} />
                <Row label="SĐT người nhà" value={sel.patient?.phone_secondary} />
                <Row label="Dân tộc" value={sel.patient?.ethnicity} />
                <Row label="Quốc tịch" value={sel.patient?.nationality} />
                <Row label="Nghề nghiệp" value={sel.patient?.occupation} />
                <Row label="Đối tượng" value={sel.patient?.patient_objection} />
                <Row label="Địa chỉ" value={sel.patient?.address} />
                <Row label="Cơ sở" value={locName(sel.patient?.location_id ?? null)} />
                <Row
                  label="Lịch hẹn"
                  value={`${fmtTimeOrNone(sel.slot_start)} · ${sel.service?.name ?? "—"}`}
                />
                <Row label="Bác sĩ" value={sel.doctor?.full_name} />
                {sel.status === "CANCELLED" && sel.cancellation_reason && (
                  <Row label="Lý do hủy" value={sel.cancellation_reason} />
                )}
                <div className="flex gap-2 pt-0.5">
                  <dt className="w-28 shrink-0 text-[#888888]">Trạng thái</dt>
                  <dd>
                    <StatusBadge status={sel.status} />
                  </dd>
                </div>
              </dl>

              {error && <p className="mt-2 text-xs text-[#dc2626]">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                {sel.status === "SCHEDULED" && (
                  <button
                    onClick={confirm}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#16a34a] px-4 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                  >
                    <Check size={15} /> Xác nhận
                  </button>
                )}
                <button
                  onClick={startEdit}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-50"
                >
                  <Pencil size={14} />
                  {sel.status === "SCHEDULED" ? "Không xác nhận / Sửa" : "Sửa"}
                </button>

                {/* Đổi lịch (CSKH/QL) — theo yêu cầu khách, lịch còn "sống" */}
                {canManage && LIVE.includes(sel.status) && (
                  <button
                    onClick={() => {
                      setShowResched((v) => !v);
                      setShowCancel(false);
                    }}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#bfdbfe] bg-white px-4 text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-50"
                  >
                    <CalendarClock size={14} /> Đổi lịch
                  </button>
                )}

                {/* Hủy lịch (CSKH/QL) — lịch còn "sống" */}
                {canManage && LIVE.includes(sel.status) && (
                  <button
                    onClick={() => {
                      setShowCancel((v) => !v);
                      setShowResched(false);
                    }}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#fecaca] bg-white px-4 text-sm font-medium text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
                  >
                    <Ban size={14} /> Hủy lịch
                  </button>
                )}
              </div>

              {/* Form lý do hủy (ẩn/hiện) */}
              {canManage && showCancel && LIVE.includes(sel.status) && (
                <div className="mt-3 space-y-2 rounded-lg border border-[#fecaca] bg-white p-3">
                  <label className={LABEL}>Lý do hủy (tuỳ chọn)</label>
                  <input
                    className={INPUT}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="VD: khách bận, đổi lịch…"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={cancelAppt}
                      disabled={busy}
                      className="min-h-10 rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50"
                    >
                      {busy ? "Đang hủy…" : "Xác nhận hủy"}
                    </button>
                    <button
                      onClick={() => setShowCancel(false)}
                      className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5]"
                    >
                      Thôi
                    </button>
                  </div>
                </div>
              )}

              {/* Đổi lịch (CSKH/QL) — đổi ngày/giờ (+ tuỳ chọn bác sĩ) */}
              {canManage && showResched && LIVE.includes(sel.status) && (
                <div className="mt-3 space-y-2 rounded-lg border border-[#bfdbfe] bg-white p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>Ngày mới</label>
                      <input
                        type="date"
                        min={todayVn()}
                        className={INPUT}
                        value={reschedDate}
                        onChange={(e) => setReschedDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Giờ mới</label>
                      <Time24Input
                        value={reschedTime}
                        onChange={setReschedTime}
                        minHour={rMinHour}
                        maxHour={rMaxHour}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Bác sĩ (tuỳ chọn)</label>
                    <select
                      className={INPUT}
                      value={reschedDoc}
                      onChange={(e) => setReschedDoc(e.target.value)}
                    >
                      <option value="">— Giữ bác sĩ hiện tại —</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={reschedule}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    <CalendarClock size={14} /> {busy ? "Đang đổi…" : "Xác nhận đổi lịch"}
                  </button>
                </div>
              )}
            </>
          ) : (
            form && (
              <div className="space-y-2">
                <div>
                  <label className={LABEL}>Họ tên</label>
                  <input
                    className={INPUT}
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>Ngày sinh</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth", e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>SĐT chính</label>
                  <input
                    className={INPUT}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 chữ số"
                    value={form.phone_primary}
                    onChange={(e) => set("phone_primary", digitsOnly(e.target.value).slice(0, 10))}
                  />
                </div>
                <div>
                  <label className={LABEL}>SĐT người nhà</label>
                  <input
                    className={INPUT}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 chữ số"
                    value={form.phone_secondary}
                    onChange={(e) => set("phone_secondary", digitsOnly(e.target.value).slice(0, 10))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Cơ sở</label>
                  <select
                    className={INPUT}
                    value={form.location_id}
                    onChange={(e) => set("location_id", e.target.value)}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Giới tính</label>
                  <select
                    className={INPUT}
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                  >
                    <option value="">— Chọn —</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Dân tộc</label>
                  <input
                    className={INPUT}
                    value={form.ethnicity}
                    onChange={(e) => set("ethnicity", e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>Quốc tịch</label>
                  <input
                    className={INPUT}
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>Nghề nghiệp</label>
                  <input
                    className={INPUT}
                    value={form.occupation}
                    onChange={(e) => set("occupation", e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>Đối tượng</label>
                  <input
                    className={INPUT}
                    value={form.patient_objection}
                    onChange={(e) => set("patient_objection", e.target.value)}
                    placeholder="DV / BHYT / ..."
                  />
                </div>
                <div>
                  <label className={LABEL}>Địa chỉ</label>
                  <input
                    className={INPUT}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
                  />
                </div>
                {error && <p className="text-xs text-[#dc2626]">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={save}
                    disabled={busy}
                    className="min-h-10 rounded-lg bg-[#ec4899] px-4 text-sm font-semibold text-white hover:bg-[#db2777] disabled:opacity-50"
                  >
                    {busy ? "Đang lưu..." : "Lưu thông tin"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={busy}
                    className="min-h-10 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5]"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            )
          )}
        </aside>
      )}
    </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-[#888888]">{label}</dt>
      <dd className="min-w-0 break-words text-[#171717]">{value || "—"}</dd>
    </div>
  );
}
