// Thứ tự khám (số thứ tự) — 1 nguồn sự thật cho mọi danh sách.
//   • CSKH nhập "ƯT1", "ƯT2"… (ưu tiên) → ĐẨY LÊN ĐẦU, sắp theo số ƯT.
//   • Số thường (1, 2, 3…) → sau nhóm ưu tiên, tăng dần.
//   • Chưa có số → cuối, sắp theo giờ hẹn.
// queue_number là TEXT (cho phép cả "ƯT1" lẫn "5"); lễ tân tự cấp số khi check-in
// nếu trống (max số + 1) — phần đó ở /api/appointments.

export interface HasQueue {
  queue_number?: string | null;
  slot_start: string;
}

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

/** So sánh 2 lịch theo thứ tự khám (ƯT trước → số → giờ). Dùng cho Array.sort. */
export function compareQueue(a: HasQueue, b: HasQueue): number {
  const ra = queueRank(a.queue_number, a.slot_start);
  const rb = queueRank(b.queue_number, b.slot_start);
  if (ra[0] !== rb[0]) return ra[0] - rb[0];
  if (ra[1] !== rb[1]) return ra[1] - rb[1];
  return ra[2].localeCompare(rb[2]);
}
