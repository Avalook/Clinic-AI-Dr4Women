#!/usr/bin/env python3
"""Parse sheet "LLV 06-2026" trong file Excel BẢNG LÀM VIỆC của phòng khám →
sinh seed SQL idempotent nạp vào bảng `work_roster` (dashboard đọc theo week_start).

VÌ SAO: /schedule query work_roster WHERE week_start = <thứ 2 của tuần>. Tuần
2026-06-15 gần như rỗng → lưới "Lịch làm việc" trống. Script này lấp 3 tuần June
(01-07, 08-14, 15-21) đang có trong sheet.

CÁCH DÙNG (chạy ở VSCode):
    python3 scripts/data_import/import_roster_llv_062026.py \
        "/Users/quangdang/Downloads/BẢNG LÀM VIỆC 06.2026 (1).xlsx" \
        > src/migrations/seed/056_roster_llv_062026.sql
    # rồi review file SQL và áp vào Supabase (psql / SQL editor).

GHI CHÚ:
  - staff_name = NGUYÊN VĂN ô Excel (tên tắt/nickname, có thể 2 người 1 ô như
    "Hằng Trang Lê"). staff_id = NULL (chưa map sang bảng staff — display vẫn đủ;
    backfill sau nếu cần "Đăng ký ca của tôi" lọc theo người).
  - Cột J "THU NGÂN THUỐC" (chỉ xuất hiện tuần 15-21) KHÔNG có station tương ứng
    trong dashboard → BỎ QUA (muốn hiện thì thêm 1 STATION key vào lib/roster.ts).
  - shift: T2–T6 = FULL; "T7/CN - Sáng" = SANG; "T7/CN - Chiều" = CHIEU.
  - Idempotent: DELETE các week_start được nạp trước khi INSERT lại.
"""
import sys
import openpyxl

SHEET = "LLV 06-2026"

# Cột (1-indexed) trong HÀNG NGÀY → station key của lib/roster.ts STATIONS.
COL_STATION = {
    3: "LICH_KHAM",
    4: "SB_CHIEU",
    5: "HSS_THU_THUAT",
    6: "LE_TAN",
    7: "LAY_MAU",
    8: "PHU_BS_KHAM",
    9: "TLYK",
    # 10: "THU NGÂN THUỐC" — không có station dashboard → bỏ qua
    11: "PHU_BS_SA",
    12: "PHONG_NGOAI_MOR",
    13: "MAY_TRONG",
    14: "MAY_NGOAI",
}


def cval(ws, r, c):
    v = ws.cell(row=r, column=c).value
    if v is None:
        return ""
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    return " ".join(str(v).split()).strip()  # gộp khoảng trắng/xuống dòng


def shift_from_label(label):
    s = label.upper()
    if "SÁNG" in s or "SANG" in s:
        return "SANG"
    if "CHIỀU" in s or "CHIEU" in s:
        return "CHIEU"
    return "FULL"


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else \
        "/Users/quangdang/Downloads/BẢNG LÀM VIỆC 06.2026 (1).xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[SHEET]

    rows = []  # (week_start, work_date, shift, station, staff_name)
    week_start = None
    work_date = None
    shift = "FULL"
    weeks = []

    for r in range(1, ws.max_row + 1):
        a = cval(ws, r, 1)
        b = cval(ws, r, 2)
        c = cval(ws, r, 3)

        if a == "Tuần":
            week_start = b  # cột B = thứ 2 của tuần
            if week_start and week_start not in weeks:
                weeks.append(week_start)
            work_date = None
            continue
        if week_start is None:
            continue
        # Hàng tiêu đề trạm (chứa "Lễ tân"/"SB - Chiều"…) — bỏ.
        if c.startswith("Lịch khám") or "Lễ tân" in cval(ws, r, 6) and a == "":
            pass

        is_day = a != "" and (a.startswith("Thứ") or a.startswith("T7") or a.startswith("CN"))
        if is_day:
            work_date = b or work_date
            shift = shift_from_label(a)
        if work_date is None:
            continue

        for col, station in COL_STATION.items():
            name = cval(ws, r, col)
            if not name:
                continue
            # bỏ hàng tiêu đề lọt lưới
            if name in ("SB - Chiều", "Lấy máu", "Máy ngoài (N/A)"):
                continue
            rows.append((week_start, work_date, shift, station, name))

    # ---- emit SQL ----
    out = []
    out.append("-- Seed work_roster từ sheet LLV 06-2026 (auto-generated bởi")
    out.append("-- scripts/data_import/import_roster_llv_062026.py). staff_id=NULL (tên tắt).")
    out.append("BEGIN;")
    wl = ", ".join(sql_str(w) for w in weeks)
    out.append(f"DELETE FROM work_roster WHERE week_start IN ({wl});")
    out.append(
        "INSERT INTO work_roster (week_start, work_date, shift, station, staff_id, staff_name, sort) VALUES"
    )
    vals = []
    for i, (ws_, wd, sh, st, nm) in enumerate(rows):
        vals.append(
            f"  ({sql_str(ws_)}, {sql_str(wd)}, '{sh}', '{st}', NULL, {sql_str(nm)}, {i})"
        )
    out.append(",\n".join(vals) + ";")
    out.append("COMMIT;")
    print("\n".join(out))

    print(
        f"-- TỔNG: {len(rows)} dòng, {len(weeks)} tuần: {weeks}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
