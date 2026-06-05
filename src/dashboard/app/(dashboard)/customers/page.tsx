// "Thông tin khách hàng" — danh bạ khách (master-detail) KÈM lịch hẹn sắp tới.
// Server đọc patient qua Supabase RLS; lọc theo NGÀY TẠO (created_at) hoặc NGÀY
// HẸN (slot_start) để biết khách thuộc ngày/tuần nào (feedback 05/06). client
// (CustomersView) lo chọn + bôi hồng.

import { getSupabaseServer } from "../../../lib/supabase-server";
import { requireNavAccess, getClinicRole } from "../../../lib/clinic-session";
import { canWriteIntake } from "../../../lib/roles";
import {
  vnTodayRangeUtc,
  vnMonthStartUtc,
  vnLocalToUtcISO,
} from "../../../lib/datetime";
import { currentWeekStartVn, shiftWeek } from "../../../lib/roster";
import CustomersView, {
  type CustomerRow,
  type ApptInfo,
  type Opt,
  type Period,
  type ByDim,
} from "./CustomersView";

export const dynamic = "force-dynamic";

/** Đầu tháng SAU theo giờ VN, dạng UTC ISO (chặn cuối cửa sổ "Tháng này"). */
function vnNextMonthStartUtc(): string {
  const ymd = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [y, m] = ymd.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return new Date(
    `${ny}-${String(nm).padStart(2, "0")}-01T00:00:00+07:00`,
  ).toISOString();
}

/** [start,end) UTC cho kỳ lọc theo giờ VN; null = "Tất cả". */
function windowFor(period: Period): { start: string; end: string } | null {
  if (period === "today") {
    const { startUtc, endUtc } = vnTodayRangeUtc();
    return { start: startUtc, end: endUtc };
  }
  if (period === "week") {
    const ws = currentWeekStartVn();
    return {
      start: vnLocalToUtcISO(ws, "00:00"),
      end: vnLocalToUtcISO(shiftWeek(ws, 1), "00:00"),
    };
  }
  if (period === "month") {
    return { start: vnMonthStartUtc(), end: vnNextMonthStartUtc() };
  }
  return null;
}

const SELECT = `
  clinic_patient_id, patient_code, full_name, date_of_birth, birth_year,
  phone_primary, phone_secondary, gender, ethnicity, nationality,
  occupation, patient_objection, address, guardian_name, location_id, created_at
`;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    period?: string;
    by?: string;
    selected?: string;
  }>;
}) {
  await requireNavAccess("/customers");
  // CSKH / Lễ tân / Quản lý: được SỬA thông tin hành chính ngay trong panel.
  const canEdit = canWriteIntake(await getClinicRole());
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const period: Period = (["today", "week", "month", "all"].includes(
    sp.period ?? "",
  )
    ? sp.period
    : "all") as Period;
  const by: ByDim = sp.by === "appt" ? "appt" : "created";
  const selected = (sp.selected ?? "").trim() || null;
  const win = windowFor(period);

  const supabase = await getSupabaseServer();

  // Lọc THEO NGÀY HẸN: tìm khách có lịch trong cửa sổ trước → lấy danh sách id.
  let apptFilterIds: string[] | null = null;
  if (by === "appt" && win) {
    const { data: inWin } = await supabase
      .from("appointment")
      .select("clinic_patient_id")
      .gte("slot_start", win.start)
      .lt("slot_start", win.end)
      .not("clinic_patient_id", "is", null)
      .limit(3000);
    apptFilterIds = [
      ...new Set((inWin ?? []).map((a) => a.clinic_patient_id as string)),
    ];
  }

  let query = supabase
    .from("patient")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(300);
  if (by === "created" && win) query = query.gte("created_at", win.start);
  if (by === "appt" && apptFilterIds) {
    // Rỗng → sentinel để .in() không lỗi và trả 0 dòng.
    query = query.in(
      "clinic_patient_id",
      apptFilterIds.length
        ? apptFilterIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  if (q) {
    const t = q.replace(/[,()%*]/g, " ").trim();
    if (t) {
      query = query.or(
        [
          `full_name.ilike.%${t}%`,
          `patient_code.ilike.%${t}%`,
          `phone_primary.ilike.%${t}%`,
        ].join(","),
      );
    }
  }

  const [{ data, error }, locRes] = await Promise.all([
    query,
    supabase.from("clinic_location").select("id, name").order("name"),
  ]);

  const rows = (data as CustomerRow[] | null) ?? [];
  const locations: Opt[] = (locRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));

  // Lịch hẹn của các khách đang hiển thị → "lịch đại diện": SẮP TỚI gần nhất,
  // nếu không có thì lịch GẦN NHẤT trong quá khứ. Kèm tổng số lịch.
  const apptByPatient: Record<string, ApptInfo> = {};
  if (rows.length) {
    const ids = rows.map((r) => r.clinic_patient_id);
    const { data: appts } = await supabase
      .from("appointment")
      .select("clinic_patient_id, slot_start, status")
      .in("clinic_patient_id", ids)
      .order("slot_start", { ascending: true })
      .limit(3000);
    const nowUtc = new Date().toISOString();
    type Raw = { clinic_patient_id: string; slot_start: string; status: string };
    const grouped: Record<string, Raw[]> = {};
    for (const a of (appts as Raw[] | null) ?? []) {
      (grouped[a.clinic_patient_id] ??= []).push(a);
    }
    for (const [pid, list] of Object.entries(grouped)) {
      const upcoming = list.find((a) => a.slot_start >= nowUtc); // list sort tăng dần
      const repr = upcoming ?? list[list.length - 1];
      if (!repr) continue;
      apptByPatient[pid] = {
        slot_start: repr.slot_start,
        status: repr.status,
        upcoming: Boolean(upcoming),
        count: list.length,
      };
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Thông tin khách hàng
        </h1>
      </header>

      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <CustomersView
          rows={rows}
          apptByPatient={apptByPatient}
          locations={locations}
          q={q}
          period={period}
          by={by}
          initialSelected={selected}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
