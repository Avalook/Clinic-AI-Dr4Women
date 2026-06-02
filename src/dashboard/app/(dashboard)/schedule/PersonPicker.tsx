// "Tôi là ai?" — cho vai trò không phải bác sĩ chọn tên mình để lọc lịch.
// Submit form (server action) lưu cookie rồi revalidate.

import { setRosterStaff } from "./actions";
import { INPUT } from "../form-ui";

export interface StaffOpt {
  id: string;
  label: string;
}

export default function PersonPicker({
  staff,
  current,
}: {
  staff: StaffOpt[];
  current: string | null;
}) {
  return (
    <form
      action={setRosterStaff}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-[13px] font-medium text-[#3f3f46]">
          Bạn là ai? (để xem lịch của mình)
        </label>
        <select name="staffId" defaultValue={current ?? ""} className={INPUT}>
          <option value="">— Chọn tên của bạn —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-[#ec4899] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#db2777] active:bg-[#db2777]"
      >
        Xem lịch
      </button>
    </form>
  );
}
