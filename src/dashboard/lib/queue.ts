// Thứ tự khám (số thứ tự) — 1 nguồn sự thật cho mọi danh sách.
//   • CSKH nhập "ƯT1", "ƯT2"… (ưu tiên) → ĐẨY LÊN ĐẦU, sắp theo số ƯT.
//   • Số thường (1, 2, 3…) → sau nhóm ưu tiên, tăng dần.
//   • Chưa có số → cuối, sắp theo giờ hẹn.
// queue_number là TEXT (cho phép cả "ƯT1" lẫn "5"); lễ tân tự cấp số khi check-in
// nếu trống (max số + 1) — phần đó ở /api/appointments.

export interface HasQueue {
  queue_number?: string | null;
  slot_start: string;
  status?: string | null;
  // — Dữ liệu cho THỨ TỰ GỌI ưu tiên (Model ②). Có thì dùng, thiếu thì fallback. —
  booking_channel?: string | null; // "WALK_IN" = vãng lai; còn lại = đặt hẹn online
  checked_in_at?: string | null; // ISO — mốc giờ ĐẾN thực tế (từ visit.checked_in_at)
  // ĐÃ có KQ cận lâm sàng, đang chờ bác sĩ ĐỌC (B3) — kéo lên ĐẦU (T-QUEUE-B3).
  b3_ready?: boolean | null;
}

/** Lab tối giản để suy "sẵn sàng đọc". triage_group='PENDING' = chưa về; khác = đã về. */
export interface LabLite {
  appointment_id?: string | null;
  triage_group?: string | null;
}

/**
 * Tập appointment "Chờ đọc KQ (B3)": có ≥1 KQ ĐÃ về (triage_group ≠ PENDING) VÀ
 * KHÔNG còn KQ nào treo (PENDING). = mọi chỉ định XN của lượt đã có kết quả → bác sĩ
 * có thể đọc/kết luận ngay. (Phase 1 chỉ lab — lab_result.appointment_id nối sạch.)
 */
export function b3ReadyApptIds(labs: LabLite[]): Set<string> {
  const agg = new Map<string, { resulted: number; pending: number }>();
  for (const l of labs) {
    const id = (l.appointment_id ?? "").trim();
    if (!id) continue;
    const e = agg.get(id) ?? { resulted: 0, pending: 0 };
    if ((l.triage_group ?? "PENDING") === "PENDING") e.pending += 1;
    else e.resulted += 1;
    agg.set(id, e);
  }
  const ready = new Set<string>();
  for (const [id, e] of agg) if (e.resulted > 0 && e.pending === 0) ready.add(id);
  return ready;
}

/** Cửa sổ trễ: người có hẹn check-in muộn quá ngần này thì MẤT ưu tiên giờ hẹn. */
export const LATE_GRACE_MS = 10 * 60_000;

/** Khóa sắp xếp: [nhóm, số trong nhóm, giờ]. Nhóm 0 = ưu tiên, 1 = số, 2 = trống. */
export function queueRank(
  queueNumber: string | null | undefined,
  slotStart: string,
): [number, number, string] {
  const s = (queueNumber ?? "").trim();
  // "ƯT", "UT", "ƯT1", "UT 2"… (Ư = U có sừng; chấp cả viết không dấu).
  const m = /^(?:Ư|U)\s*T\s*0*(\d*)/i.exec(s);
  if (m) return [0, m[1] ? Number(m[1]) : 0, slotStart];
  const n = parseInt(s, 10);
  if (Number.isFinite(n)) return [1, n, slotStart];
  return [2, 0, slotStart];
}

/**
 * Khóa THỨ TỰ GỌI KHÁM (Model ②) cho người ĐÃ check-in:
 *   tầng −1: ƯT (người quen nhà bác sĩ) — gõ tay, luôn lên đầu, theo số ƯT.
 *   tầng  0: CÓ HẸN & đến ĐÚNG GIỜ (checked_in_at ≤ giờ hẹn + 10') — sắp theo GIỜ HẸN.
 *   tầng  1: walk-in HOẶC có hẹn đến TRỄ — sắp theo GIỜ ĐẾN (vé tự nhường người tới trước).
 * Thiếu cả booking_channel lẫn checked_in_at ⇒ fallback thứ tự cũ (ƯT → số → giờ).
 */
export function callRank(a: HasQueue): [number, number, string] {
  // Tầng −2: ĐÃ có KQ, chờ bác sĩ ĐỌC (B3). Lên trên cả ƯT/có-hẹn — đọc nhanh ~5',
  // giải phóng phòng + BN đã chờ qua B2. Trong làn xếp theo giờ ĐẾN (chờ lâu trước).
  if (a.b3_ready) {
    const inMs = a.checked_in_at
      ? new Date(a.checked_in_at).getTime()
      : new Date(a.slot_start).getTime();
    return [-2, inMs, a.checked_in_at ?? a.slot_start];
  }
  if (a.booking_channel == null && a.checked_in_at == null) {
    return queueRank(a.queue_number, a.slot_start);
  }
  const s = (a.queue_number ?? "").trim();
  const ut = /^(?:Ư|U)\s*T\s*0*(\d*)/i.exec(s);
  if (ut) return [-1, ut[1] ? Number(ut[1]) : 0, a.slot_start];

  const slotMs = new Date(a.slot_start).getTime();
  const isBooked = !!a.booking_channel && a.booking_channel !== "WALK_IN";
  if (isBooked && a.checked_in_at) {
    const inMs = new Date(a.checked_in_at).getTime();
    if (inMs <= slotMs + LATE_GRACE_MS) return [0, slotMs, a.checked_in_at];
  }
  const arriveMs = a.checked_in_at ? new Date(a.checked_in_at).getTime() : slotMs;
  return [1, arriveMs, a.checked_in_at ?? a.slot_start];
}

/** So sánh 2 lịch theo thứ tự khám. Người đã đến: ưu tiên Model ②; chưa đến: ƯT → số → giờ. */
export function compareQueue(a: HasQueue, b: HasQueue): number {
  const isCheckedInA = a.status === "CHECKED_IN";
  const isCheckedInB = b.status === "CHECKED_IN";
  if (isCheckedInA !== isCheckedInB) {
    return isCheckedInA ? -1 : 1;
  }

  const ra = isCheckedInA ? callRank(a) : queueRank(a.queue_number, a.slot_start);
  const rb = isCheckedInB ? callRank(b) : queueRank(b.queue_number, b.slot_start);
  if (ra[0] !== rb[0]) return ra[0] - rb[0];
  if (ra[1] !== rb[1]) return ra[1] - rb[1];
  return ra[2].localeCompare(rb[2]);
}
