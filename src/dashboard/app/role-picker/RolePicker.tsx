"use client";

import { useState } from "react";
import { Stethoscope, Headset, BarChart3, ClipboardCheck } from "lucide-react";
import { chooseRole } from "./actions";

export interface DoctorOption {
  id: string;
  full_name: string;
  short_name: string | null;
  primary_department: string;
}

const CARD =
  "flex flex-col items-center justify-center gap-2 rounded-xl border border-[#e4e4e7] bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 hover:border-[#ec4899] hover:shadow-[0_2px_8px_rgba(236,72,153,0.15)]";

export default function RolePicker({ doctors }: { doctors: DoctorOption[] }) {
  const [docId, setDocId] = useState("");
  const selectedDoctor = doctors.find((d) => d.id === docId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold text-[#171717]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ec4899]" />
          Dr4Women
        </h1>
        <p className="mt-1 text-sm text-[#888888]">
          Chọn vai trò để vào đúng giao diện của bạn
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Bác sĩ — pick which doctor first, then enter. */}
        <form action={chooseRole} className={CARD}>
          <Stethoscope size={28} className="text-[#ec4899]" />
          <span className="text-base font-medium text-[#171717]">Bác sĩ</span>
          <span className="text-xs text-[#888888]">
            Xem lịch khám + bệnh nhân của mình
          </span>
          <input
            type="hidden"
            name="role"
            value={selectedDoctor?.primary_department ?? "DOCTOR"}
          />
          <input type="hidden" name="staffId" value={docId} />
          <select
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-[#e4e4e7] px-2 py-2 text-base text-[#171717] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20 sm:min-h-0 sm:py-1.5 sm:text-sm"
          >
            <option value="">— Chọn tên bác sĩ —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
                {d.primary_department === "ULTRASOUND_DOCTOR" ? " (SA)" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!docId}
            className="mt-1 min-h-11 w-full rounded-md bg-[#ec4899] px-3 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#db2777] active:bg-[#db2777] disabled:opacity-40 sm:min-h-0 sm:py-1.5"
          >
            Vào
          </button>
        </form>

        <RoleCard
          role="CSKH"
          label="CSKH"
          hint="Nhập bệnh nhân mới + đặt lịch"
          icon={<Headset size={28} className="text-[#ec4899]" />}
        />
        <RoleCard
          role="RECEPTION"
          label="Lễ tân"
          hint="Tiếp đón + đặt lịch hẹn"
          icon={<ClipboardCheck size={28} className="text-[#ec4899]" />}
        />
        <RoleCard
          role="MANAGEMENT"
          label="Quản lý"
          hint="Báo cáo + quản trị"
          icon={<BarChart3 size={28} className="text-[#ec4899]" />}
        />
      </div>
    </div>
  );
}

function RoleCard({
  role,
  label,
  hint,
  icon,
}: {
  role: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <form action={chooseRole} className="contents">
      <input type="hidden" name="role" value={role} />
      <button type="submit" className={CARD}>
        {icon}
        <span className="text-base font-medium text-[#171717]">{label}</span>
        <span className="text-xs text-[#888888]">{hint}</span>
      </button>
    </form>
  );
}
