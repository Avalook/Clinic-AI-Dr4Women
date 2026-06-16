// Config form KHÁM PHỤ KHOA (service_code "PK") — pilot cho engine.
// Trường lấy từ section "Khám Phụ khoa" (Lý do / Bệnh sử / Tiền sử bản thân+gia đình /
// Tiền sử phụ khoa [menarche, chu kỳ, LMP, PARA…] / Khám tổng quát [sinh hiệu] /
// Khám chuyên khoa [trong–ngoài] / Cận lâm sàng / Chẩn đoán / Điều trị / Tái khám).
// Lưu ý: docx gốc KHÔNG có trong repo — trường điền từ cấu trúc packet + chuẩn sản phụ khoa.

import type { FormSchema } from "./types";

const TAIKHAM_XN = [
  { value: "HM", label: "Hormone" },
  { value: "SH", label: "Sinh hóa" },
  { value: "SA", label: "Siêu âm" },
  { value: "DXA", label: "Đo loãng xương" },
  { value: "PS", label: "Pap smear" },
];

export const pkSchema: FormSchema = {
  service_code: "PK",
  title: "Khám Phụ khoa",
  sections: [
    {
      title: "Lý do khám",
      fields: [
        { key: "ly_do", label: "Lý do vào khám", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Bệnh sử",
      fields: [
        { key: "benh_su", label: "Quá trình bệnh lý", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Tiền sử bản thân & gia đình",
      fields: [
        { key: "ts_benh_man", label: "Bệnh mạn tính", type: "text" },
        { key: "ts_di_ung", label: "Dị ứng", type: "text" },
        { key: "ts_phau_thuat", label: "Tiền sử phẫu thuật", type: "text" },
        { key: "ts_thuoc", label: "Thuốc đang dùng", type: "text" },
        { key: "ts_gia_dinh", label: "Tiền sử gia đình", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Tiền sử phụ khoa",
      fields: [
        { key: "menarche", label: "Tuổi có kinh đầu (menarche)", type: "number", unit: "tuổi" },
        {
          key: "chu_ky_tinh_chat",
          label: "Tính chất chu kỳ",
          type: "radio",
          options: [
            { value: "deu", label: "Đều" },
            { value: "khong_deu", label: "Không đều" },
          ],
        },
        { key: "chu_ky_vong", label: "Độ dài vòng kinh", type: "number", unit: "ngày" },
        { key: "so_ngay_hanh_kinh", label: "Số ngày hành kinh", type: "number", unit: "ngày" },
        {
          key: "luong_kinh",
          label: "Lượng kinh",
          type: "radio",
          options: [
            { value: "it", label: "Ít" },
            { value: "vua", label: "Vừa" },
            { value: "nhieu", label: "Nhiều" },
          ],
        },
        {
          key: "dau_bung_kinh",
          label: "Đau bụng kinh",
          type: "radio",
          options: [
            { value: "khong", label: "Không" },
            { value: "nhe", label: "Nhẹ" },
            { value: "nhieu", label: "Nhiều" },
          ],
        },
        { key: "lmp", label: "Kỳ kinh cuối (LMP)", type: "date" },
        { key: "para", label: "PARA (đủ tháng–non–sảy–sống)", type: "text", placeholder: "VD: 2002" },
        { key: "tranh_thai", label: "Biện pháp tránh thai", type: "text" },
        { key: "ts_phu_khoa_khac", label: "Tiền sử phụ khoa khác", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Khám tổng quát (sinh hiệu)",
      fields: [
        { key: "mach", label: "Mạch", type: "number", unit: "l/p" },
        { key: "nhiet_do", label: "Nhiệt độ", type: "number", unit: "°C" },
        { key: "huyet_ap", label: "Huyết áp", type: "text", unit: "mmHg", placeholder: "vd 120/80" },
        { key: "nhip_tho", label: "Nhịp thở", type: "number", unit: "l/p" },
        { key: "can_nang", label: "Cân nặng", type: "number", unit: "kg" },
        { key: "chieu_cao", label: "Chiều cao", type: "number", unit: "cm" },
        { key: "bmi", label: "BMI", type: "number" },
        { key: "kham_toan_than", label: "Khám toàn thân", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Khám chuyên khoa",
      fields: [
        { key: "kham_ngoai", label: "Khám ngoài (âm hộ, TSM)", type: "textarea", fullWidth: true },
        { key: "kham_mo_vit", label: "Khám mỏ vịt (âm đạo, CTC)", type: "textarea", fullWidth: true },
        { key: "kham_trong", label: "Thăm khám trong (tử cung, phần phụ)", type: "textarea", fullWidth: true },
        {
          key: "khi_hu",
          label: "Khí hư bất thường",
          type: "radio",
          options: [
            { value: "khong", label: "Không" },
            { value: "co", label: "Có" },
          ],
        },
        {
          key: "khi_hu_mo_ta",
          label: "Mô tả khí hư (màu, mùi, lượng)",
          type: "conditional",
          parent: { key: "khi_hu", equals: "co" },
          fullWidth: true,
        },
      ],
    },
    {
      title: "Cận lâm sàng",
      fields: [
        { key: "cls_sieu_am", label: "Siêu âm", type: "textarea", fullWidth: true },
        { key: "cls_xet_nghiem", label: "Xét nghiệm", type: "textarea", fullWidth: true },
        { key: "cls_khac", label: "Cận lâm sàng khác", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Chẩn đoán",
      fields: [
        { key: "chan_doan", label: "Chẩn đoán", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Điều trị",
      fields: [
        { key: "huong_xu_ly", label: "Hướng xử lý", type: "textarea", fullWidth: true },
        { key: "don_thuoc", label: "Đơn thuốc", type: "textarea", fullWidth: true },
      ],
    },
    {
      title: "Tái khám",
      fields: [
        { key: "tai_kham_ngay", label: "Ngày tái khám", type: "date" },
        {
          key: "tai_kham_xn",
          label: "Xét nghiệm cần kiểm tra lại",
          type: "checkbox_group",
          options: TAIKHAM_XN,
          fullWidth: true,
        },
        { key: "tai_kham_ghi_chu", label: "Ghi chú tái khám", type: "text", fullWidth: true },
      ],
    },
  ],
};
