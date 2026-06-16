"use client";

// ENGINE form khám chuyên khoa — đọc schema theo service_code rồi TỰ SINH form
// (KHÔNG hard-code từng form). Đọc/ghi form_data JSONB qua /api/clinical-form.
// READ-ONLY khi readOnly=true (vd visit FINALIZED) — route cũng chặn ghi (409).

import { useEffect, useMemo, useState } from "react";
import { INPUT, LABEL } from "../form-ui";
import { getFormSchema } from "../../../lib/form-schemas";
import type { FormData, FormField, FieldValue } from "../../../lib/form-schemas/types";

function isVisible(field: FormField, values: FormData): boolean {
  if (!field.parent) return true;
  const pv = values[field.parent.key];
  if (Array.isArray(pv)) return pv.includes(field.parent.equals as string);
  return pv === field.parent.equals;
}

export default function ServiceFormEngine({
  visitId,
  serviceCode,
  readOnly = false,
}: {
  visitId: string | null;
  serviceCode: string | null;
  readOnly?: boolean;
}) {
  const schema = useMemo(() => getFormSchema(serviceCode), [serviceCode]);
  const [values, setValues] = useState<FormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Không có config / chưa có visit → component return null bên dưới; bỏ qua fetch.
    if (!schema || !visitId) return;
    let on = true;
    fetch(`/api/clinical-form?visitId=${visitId}&serviceCode=${schema.service_code}`)
      .then((r) => r.json())
      .then((d: { form_data?: FormData }) => {
        if (on) setValues(d.form_data ?? {});
      })
      .catch(() => on && setValues({}))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [schema, visitId]);

  // Engine chỉ render khi có config + có visit. Không có → ẩn (không vỡ layout).
  if (!schema || !visitId) return null;

  const set = (key: string, v: FieldValue) => setValues((s) => ({ ...s, [key]: v }));
  const toggleGroup = (key: string, opt: string) =>
    setValues((s) => {
      const cur = Array.isArray(s[key]) ? (s[key] as string[]) : [];
      return {
        ...s,
        [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
      };
    });

  async function save() {
    if (readOnly) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/clinical-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitId,
        serviceCode: schema!.service_code,
        form_data: values,
      }),
    });
    setSaving(false);
    setMsg(
      res.ok
        ? "Đã lưu phiếu khám."
        : (await res.json().catch(() => ({}))).error ?? "Lỗi lưu phiếu.",
    );
  }

  return (
    <div className="rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#171717]">
          Phiếu {schema.title}
          <span className="ml-2 rounded bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-medium text-[#6d28d9]">
            form chuyên khoa
          </span>
        </h4>
        {readOnly && (
          <span className="text-xs text-[#dc2626]">🔒 chỉ xem</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#a1a1aa]">Đang tải phiếu…</p>
      ) : (
        <div className="space-y-4">
          {schema.sections.map((section) => (
            <section key={section.title} className="border-t border-[#f4f4f5] pt-2.5">
              <p className="mb-1.5 text-sm font-semibold text-[#9d2463]">
                {section.title}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {section.fields
                  .filter((f) => isVisible(f, values))
                  .map((f) => (
                    <Field
                      key={f.key}
                      field={f}
                      value={values[f.key]}
                      disabled={readOnly}
                      onChange={(v) => set(f.key, v)}
                      onToggleGroup={(opt) => toggleGroup(f.key, opt)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!readOnly && !loading && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f4f4f5] pt-3">
          <span
            className={
              "text-xs " +
              (msg?.startsWith("Đã lưu") ? "text-[#15803d]" : "text-[#dc2626]")
            }
          >
            {msg ?? ""}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="min-h-9 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : `Lưu phiếu ${schema.title}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  field,
  value,
  disabled,
  onChange,
  onToggleGroup,
}: {
  field: FormField;
  value: FieldValue;
  disabled: boolean;
  onChange: (v: FieldValue) => void;
  onToggleGroup: (opt: string) => void;
}) {
  const full = field.fullWidth || field.type === "textarea" || field.type === "conditional";
  const sv = typeof value === "string" ? value : value == null ? "" : String(value);

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
    case "conditional":
      control = (
        <textarea
          className={INPUT}
          rows={2}
          value={sv}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "number":
      control = (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            className={INPUT}
            value={sv}
            disabled={disabled}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.unit && (
            <span className="shrink-0 text-xs text-[#a1a1aa]">{field.unit}</span>
          )}
        </div>
      );
      break;
    case "date":
      control = (
        <input
          type="date"
          className={INPUT}
          value={sv}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "radio":
      control = (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 text-sm text-[#3f3f46]">
              <input
                type="radio"
                className="h-4 w-4 accent-[#ec4899]"
                name={field.key}
                checked={value === o.value}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    case "checkbox":
      control = (
        <label className="inline-flex items-center gap-1.5 text-sm text-[#3f3f46]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#ec4899]"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
      break;
    case "checkbox_group": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 text-sm text-[#3f3f46]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#ec4899]"
                checked={arr.includes(o.value)}
                disabled={disabled}
                onChange={() => onToggleGroup(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    }
    default: // text
      control = (
        <input
          className={INPUT}
          value={sv}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  // checkbox tự gói nhãn → không lặp label phía trên.
  if (field.type === "checkbox") {
    return <div className={full ? "sm:col-span-2" : ""}>{control}</div>;
  }
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className={LABEL}>{field.label}</label>
      {control}
    </div>
  );
}
