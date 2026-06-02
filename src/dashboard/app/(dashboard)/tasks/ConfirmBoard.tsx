"use client";

// CSKH "Tình trạng lịch hẹn" — kanban theo dõi hồ sơ: Chờ xác nhận → Đã xác nhận.
// Click tên KH → sổ panel thông tin đầy đủ + 2 nút:
//   • Xác nhận       → cskh_confirm → chuyển sang "Đã xác nhận"
//   • Không xác nhận → sửa thông tin BN ngay tại chỗ (PATCH /api/patients)
// CCCD KHÔNG hiển thị/sửa ở đây (D-identity).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { fmtTimeOrNone } from "../../../lib/datetime";
import { INPUT, LABEL } from "../form-ui";

export interface Opt {
  id: string;
  label: string;
}

export interface ApptRow {
  id: string;
  slot_start: string;
  status: string;
  booking_channel: string | null;
  patient: {
    clinic_patient_id: string;
    full_name: string;
    patient_code: string;
    phone_primary: string | null;
    phone_secondary: string | null;
    date_of_birth: string | null;
    location_id: string | null;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

const COLUMNS = [
  { key: "pending", label: "Chờ xác nhận", statuses: ["SCHEDULED"], dot: "#2563eb" },
  {
    key: "confirmed",
    label: "Đã xác nhận",
    statuses: ["CONFIRMED", "CHECKED_IN"],
    dot: "#16a34a",
  },
];

interface Form {
  full_name: string;
  date_of_birth: string;
  phone_primary: string;
  phone_secondary: string;
  location_id: string;
}

export default function ConfirmBoard({
  rows,
  locations,
}: {
  rows: ApptRow[];
  locations: Opt[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locName = (id: string | null) =>
    locations.find((l) => l.id === id)?.label ?? "—";

  function openCard(a: ApptRow) {
    setError(null);
    setEditId(null);
    setOpenId(openId === a.id ? null : a.id);
  }

  function startEdit(a: ApptRow) {
    const p = a.patient;
    setForm({
      full_name: p?.full_name ?? "",
      date_of_birth: p?.date_of_birth ?? "",
      phone_primary: p?.phone_primary ?? "",
      phone_secondary: p?.phone_secondary ?? "",
      location_id: p?.location_id ?? locations[0]?.id ?? "",
    });
    setEditId(a.id);
    setError(null);
  }

  async function confirm(a: ApptRow) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, action: "cskh_confirm" }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Lỗi xác nhận.");
      return;
    }
    setOpenId(null);
    router.refresh();
  }

  async function save(a: ApptRow) {
    if (!form) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_patient_id: a.patient?.clinic_patient_id,
        ...form,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Lỗi lưu thông tin.");
      return;
    }
    setEditId(null);
    router.refresh();
  }

  const field = (k: keyof Form, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {COLUMNS.map((col) => {
        const items = rows.filter((r) => col.statuses.includes(r.status));
        return (
          <div
            key={col.key}
            className="flex flex-col rounded-xl border border-[#e4e4e7] bg-[#fafafa]"
          >
            <div className="flex items-center gap-2 rounded-t-xl border-b border-[#e4e4e7] bg-white px-3 py-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: col.dot }}
              />
              <span className="text-sm font-semibold text-[#171717]">
                {col.label}
              </span>
              <span className="ml-auto rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs text-[#71717a]">
                {items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 p-2">
              {items.length === 0 && (
                <p className="py-6 text-center text-xs text-[#a1a1aa]">Trống</p>
              )}
              {items.map((a) => {
                const open = openId === a.id;
                const editing = editId === a.id;
                const p = a.patient;
                return (
                  <div
                    key={a.id}
                    className={
                      "rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] " +
                      (open ? "border-[#ec4899]" : "border-[#e4e4e7]")
                    }
                  >
                    {/* Thẻ (click tên để sổ) */}
                    <button
                      onClick={() => openCard(a)}
                      className="w-full p-3 text-left"
                    >
                      <span className="font-medium text-[#171717]">
                        {p?.full_name ?? "—"}
                      </span>
                      <p className="mt-0.5 font-mono text-xs text-[#888888]">
                        {p?.patient_code}
                        {p?.phone_primary ? ` · ${p.phone_primary}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-[#171717]">
                        {fmtTimeOrNone(a.slot_start)}
                        {a.service?.name ? ` · ${a.service.name}` : ""}
                      </p>
                      <p className="text-xs text-[#71717a]">
                        {a.doctor?.full_name ?? "—"}
                        {a.booking_channel ? ` · ${a.booking_channel}` : ""}
                      </p>
                    </button>

                    {/* Panel sổ ra */}
                    {open && (
                      <div className="border-t border-[#f4f4f5] bg-[#fdf2f8] p-3">
                        <h4 className="mb-2 text-sm font-semibold text-[#9d174d]">
                          Thông tin khách hàng
                        </h4>

                        {!editing ? (
                          <>
                            <dl className="space-y-1 text-sm">
                              <Row label="Họ tên" value={p?.full_name} />
                              <Row label="Ngày sinh" value={p?.date_of_birth} />
                              <Row label="SĐT chính" value={p?.phone_primary} />
                              <Row
                                label="SĐT người nhà"
                                value={p?.phone_secondary}
                              />
                              <Row label="Cơ sở" value={locName(p?.location_id ?? null)} />
                              <Row
                                label="Lịch hẹn"
                                value={`${fmtTimeOrNone(a.slot_start)} · ${a.service?.name ?? "—"}`}
                              />
                              <Row label="Bác sĩ" value={a.doctor?.full_name} />
                            </dl>

                            {error && open && (
                              <p className="mt-2 text-xs text-[#dc2626]">{error}</p>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {a.status === "SCHEDULED" && (
                                <button
                                  onClick={() => confirm(a)}
                                  disabled={busy}
                                  className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#16a34a] px-3 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
                                >
                                  <Check size={15} /> Xác nhận
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(a)}
                                disabled={busy}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-50"
                              >
                                <Pencil size={14} />
                                {a.status === "SCHEDULED"
                                  ? "Không xác nhận / Sửa"
                                  : "Sửa thông tin"}
                              </button>
                            </div>
                          </>
                        ) : (
                          form && (
                            <div className="space-y-2">
                              <div>
                                <label className={LABEL}>Họ tên</label>
                                <input
                                  className={INPUT}
                                  value={form.full_name}
                                  onChange={(e) => field("full_name", e.target.value)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={LABEL}>Ngày sinh</label>
                                  <input
                                    type="date"
                                    className={INPUT}
                                    value={form.date_of_birth}
                                    onChange={(e) =>
                                      field("date_of_birth", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <label className={LABEL}>Cơ sở</label>
                                  <select
                                    className={INPUT}
                                    value={form.location_id}
                                    onChange={(e) =>
                                      field("location_id", e.target.value)
                                    }
                                  >
                                    {locations.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={LABEL}>SĐT chính</label>
                                  <input
                                    className={INPUT}
                                    inputMode="tel"
                                    value={form.phone_primary}
                                    onChange={(e) =>
                                      field("phone_primary", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <label className={LABEL}>SĐT người nhà</label>
                                  <input
                                    className={INPUT}
                                    inputMode="tel"
                                    value={form.phone_secondary}
                                    onChange={(e) =>
                                      field("phone_secondary", e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              {error && (
                                <p className="text-xs text-[#dc2626]">{error}</p>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => save(a)}
                                  disabled={busy}
                                  className="min-h-9 rounded-lg bg-[#ec4899] px-4 text-sm font-semibold text-white hover:bg-[#db2777] disabled:opacity-50"
                                >
                                  {busy ? "Đang lưu..." : "Lưu thông tin"}
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  disabled={busy}
                                  className="min-h-9 rounded-lg border border-[#e4e4e7] bg-white px-4 text-sm text-[#52525b] hover:bg-[#f4f4f5]"
                                >
                                  Huỷ
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-[#888888]">{label}</dt>
      <dd className="text-[#171717]">{value || "—"}</dd>
    </div>
  );
}
