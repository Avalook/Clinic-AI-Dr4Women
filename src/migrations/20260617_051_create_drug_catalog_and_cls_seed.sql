-- 051 — Danh mục THUỐC (drug_catalog mới) + CHỈ ĐỊNH CLS (seed vào service_price).
-- Nguồn: PHIẾU CHỈ ĐỊNH (PK gửi) → scripts/parse_chidinh_catalog.py.
-- BOUNDARY: giá NULL (lazy-fill ở màn Thu ngân); thuốc giữ name_raw VERBATIM,
-- variant best-effort, needs_review=TRUE cho dòng không chắc; dịch vụ chỉ THÊM
-- NEW (ON CONFLICT DO NOTHING) — KHÔNG đụng rows/giá đã có.
-- Apply LẺ out-of-band (psql trực tiếp + apply_migrations.py --mark-applied),
-- KHÔNG sequential-to-max, KHÔNG chạm lỗ 043.

BEGIN;

-- (1) Master danh mục thuốc — picker "Đơn thuốc" đọc từ đây (name_raw + variant).
CREATE TABLE IF NOT EXISTS drug_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_base   TEXT NOT NULL,
    name_raw    TEXT NOT NULL UNIQUE,          -- VERBATIM từ phiếu PK; key idempotent
    variant     TEXT,                          -- best-effort (2v/4v, (Đ)/(U), 10v/15v...)
    group_label TEXT,                          -- dòng-nhóm trong phiếu (L1..L9)
    unit_price  NUMERIC(12, 0),                -- VND; NULL = chưa nhập giá (lazy-fill)
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,-- TRUE = dược cần xác nhận biến thể/định danh
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drug_catalog_active ON drug_catalog (name_base) WHERE is_active;

COMMENT ON TABLE drug_catalog IS 'Danh mục thuốc (menu BS kê đơn). Nguồn: PHIẾU CHỈ ĐỊNH PK. Giá lazy-fill.';
COMMENT ON COLUMN drug_catalog.name_raw IS 'Tên thuốc VERBATIM từ phiếu (gồm cả biến thể trong ngoặc).';
COMMENT ON COLUMN drug_catalog.needs_review IS 'TRUE: định danh/biến thể chưa chắc, dược xác nhận trước khi dùng thật.';

ALTER TABLE drug_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drug_catalog_select_authenticated ON drug_catalog;
CREATE POLICY drug_catalog_select_authenticated
  ON drug_catalog FOR SELECT TO authenticated USING (true);

-- (2) service_price: thêm cột phân loại CLS để picker "Chỉ định CLS" group theo nhóm.
--     Cột nullable → rows cũ KHÔNG bị đụng (đúng boundary).
ALTER TABLE service_price ADD COLUMN IF NOT EXISTS category TEXT;  -- nhóm CLS (Thai/Nội tiết.../Thủ thuật/Chụp phim/Tầng 1)
ALTER TABLE service_price ADD COLUMN IF NOT EXISTS tang TEXT;      -- tầng (best-effort, có thể NULL)
COMMENT ON COLUMN service_price.category IS 'Nhóm CLS để picker Chỉ định CLS gom nhóm (NULL cho dòng nhập tay ở Thu ngân).';

-- (3) Seed THUỐC → drug_catalog (giá NULL).
INSERT INTO drug_catalog (name_base, name_raw, variant, group_label, needs_review) VALUES
  ('Besuto', 'Besuto', NULL, 'L1', FALSE),
  ('Canxi', 'Canxi', NULL, 'L1', FALSE),
  ('Venice', 'Venice', NULL, 'L1', FALSE),
  ('Ferlatum', 'Ferlatum', NULL, 'L1', FALSE),
  ('Vitcofol', 'Vitcofol', NULL, 'L1', FALSE),
  ('Magie', 'Magie', NULL, 'L1', FALSE),
  ('Aspirin', 'Aspirin', NULL, 'L1', FALSE),
  ('Yspuripax', 'Yspuripax (2v/4v)', '2v/4v', 'L1', FALSE),
  ('DHA', 'DHA', NULL, 'L1', FALSE),
  ('Pruzena', 'Pruzena', NULL, 'L1', FALSE),
  ('Folic Mum', 'Folic Mum', NULL, 'L1', FALSE),
  ('Glucophage', 'Glucophage', NULL, 'L2', FALSE),
  ('Diane', 'Diane', NULL, 'L2', FALSE),
  ('Endokirogen', 'Endokirogen', NULL, 'L2', FALSE),
  ('Letrozole', 'Letrozole (10v, 15v)', '10v, 15v', 'L2', FALSE),
  ('Ovagrow', 'Ovagrow', NULL, 'L2', FALSE),
  ('Duphaston', 'Duphaston (4v/ 2v)', '4v/ 2v', 'L3', FALSE),
  ('Androgel', 'Androgel', NULL, 'L3', FALSE),
  ('Estrogel', 'Estrogel', NULL, 'L3', FALSE),
  ('Fes 1/10', 'Fes 1/10', NULL, 'L3', TRUE),
  ('Fes ⅕', 'Fes ⅕', NULL, 'L3', FALSE),
  ('Cyclo Progynova', 'Cyclo Progynova', NULL, 'L3', FALSE),
  ('Utrogestan', 'Utrogestan (Đ) (1v/2v): (U)', 'Đ; 1v/2v; U', 'L4', TRUE),
  ('DHEA', 'DHEA (U)', 'U', 'L4', FALSE),
  ('DHEA', 'DHEA (Đ)', 'Đ', 'L4', FALSE),
  ('Hyalogyn', 'Hyalogyn', NULL, 'L4', FALSE),
  ('Cavidagel', 'Cavidagel', NULL, 'L4', FALSE),
  ('Valiera', 'Valiera(1v/2v/3v)', '1v/2v/3v', 'L4', FALSE),
  ('Valiera', 'Valiera(Đ)', 'Đ', 'L4', FALSE),
  ('Follitrope', 'Follitrope', NULL, 'L5', FALSE),
  ('Cetrotide', 'Cetrotide', NULL, 'L5', FALSE),
  ('Ovitrelle', 'Ovitrelle', NULL, 'L5', FALSE),
  ('IVF-C', 'IVF-C', NULL, 'L5', FALSE),
  ('IFV-M', 'IFV-M', NULL, 'L5', FALSE),
  ('Diphereline', 'Diphereline (3.75/0.1)', '3.75/0.1', 'L5', FALSE),
  ('GonaF', 'GonaF', NULL, 'L5', FALSE),
  ('Dalacin C', 'Dalacin C', NULL, 'L6', FALSE),
  ('Assicin', 'Assicin (3v/6v/9v)', '3v/6v/9v', 'L6', FALSE),
  ('Cefdinir', 'Cefdinir', NULL, 'L6', FALSE),
  ('Docy', 'Docy (15v/30v)', '15v/30v', 'L6', FALSE),
  ('Metronidazol', 'Metronidazol', NULL, 'L6', FALSE),
  ('Dermolivo', 'Dermolivo', NULL, 'L7', FALSE),
  ('Meclon', 'Meclon', NULL, 'L7', FALSE),
  ('Nystatin', 'Nystatin', NULL, 'L7', FALSE),
  ('Lomexin', 'Lomexin', NULL, 'L7', FALSE),
  ('Canesten', 'Canesten', NULL, 'L7', FALSE),
  ('Bennatfort', 'Bennatfort', NULL, 'L7', FALSE),
  ('Intimate', 'Intimate', NULL, 'L7', FALSE),
  ('Cumlaude Lubripiu HA', 'Cumlaude Lubripiu HA', NULL, 'L7', FALSE),
  ('Cumlaude prebiotic', 'Cumlaude prebiotic', NULL, 'L7', FALSE),
  ('Eulac', 'Eulac', NULL, 'L7', FALSE),
  ('Difavon/Diflucan/Fluconazole/Zolmed', 'Difavon/Diflucan/Fluconazole/Zolmed', NULL, 'L8', TRUE),
  ('Cyclo', 'Cyclo', NULL, 'L8', FALSE),
  ('Estrogel pump', 'Estrogel pump', NULL, 'L8', FALSE),
  ('Daikyn', 'Daikyn', NULL, 'L8', FALSE),
  ('Kofio', 'Kofio', NULL, 'L8', FALSE),
  ('ZinC', 'ZinC', NULL, 'L9', FALSE),
  ('CoQ10', 'CoQ10 (1/2)', '1/2', 'L9', FALSE),
  ('Glutathione', 'Glutathione (2/4)', '2/4', 'L9', FALSE),
  ('Tadalafil 20', 'Tadalafil 20', NULL, 'L9', FALSE),
  ('Tadalafil 5mg', 'Tadalafil 5mg', NULL, 'L9', FALSE),
  ('Kingseal', 'Kingseal', NULL, 'L9', FALSE),
  ('L-Agrinine', 'L-Agrinine', NULL, 'L9', FALSE),
  ('Durapil', 'Durapil', NULL, 'L9', FALSE)
ON CONFLICT (name_raw) DO NOTHING;

-- (4) Seed dịch vụ/CLS NEW → service_price (group='dich_vu', giá NULL). KHÔNG đụng rows cũ.
INSERT INTO service_price (service_code, name, "group", category, tang) VALUES
  ('CLS_NUOC_TIEU', 'Nước tiểu', 'dich_vu', 'Tầng 1', 'Tầng 1'),
  ('CLS_DO_MAT_DO_XUONG', 'Đo mật độ xương', 'dich_vu', 'Tầng 1', 'Tầng 1'),
  ('CLS_XET_NGHIEM_DICH_AM_DAO', 'Xét nghiệm dịch âm đạo', 'dich_vu', 'Tầng 1', 'Tầng 1'),
  ('CLS_XET_NGHIEM_MAU', 'Xét nghiệm máu', 'dich_vu', 'Tầng 1', 'Tầng 1'),
  ('CLS_KHAM_PHU_KHOA', 'Khám phụ khoa', 'dich_vu', 'Tầng 1', 'Tầng 1'),
  ('CLS_DAT_VONG_NOI_TIET', 'Đặt vòng nội tiết', 'dich_vu', 'Thủ thuật', NULL),
  ('CLS_THAO_VONG', 'Tháo vòng', 'dich_vu', 'Thủ thuật', NULL),
  ('CLS_CAY_QUE_TRANH_THAI', 'Cấy que tránh thai', 'dich_vu', 'Thủ thuật', NULL),
  ('CLS_THAO_QUE_TRANH_THAI', 'Tháo que tránh thai', 'dich_vu', 'Thủ thuật', NULL),
  ('CLS_SOI_CO_TU_CUNG', 'Soi cổ tử cung', 'dich_vu', 'Thủ thuật', NULL),
  ('CLS_CHUP_VU_EP', 'Chụp vú ép', 'dich_vu', 'Chụp phim ngoài', NULL),
  ('CLS_CHUP_MRI_VU', 'Chụp MRI vú', 'dich_vu', 'Chụp phim ngoài', NULL),
  ('CLS_CHUP_TU_CUNG_VOI_TRUNG', 'Chụp tử cung – vòi trứng', 'dich_vu', 'Chụp phim ngoài', NULL),
  ('CLS_CHAY_MONITORING', 'Chạy monitoring', 'dich_vu', 'Chụp phim ngoài', 'Tầng 2/ Tầng 4'),
  ('CLS_SIEU_AM_3D_THAI_12_TUAN', 'Siêu âm 3D thai <12 tuần', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_3D_THAI_12_TUAN_2', 'Siêu âm 3D thai >12 tuần', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_THAI_6D', 'Siêu âm thai 6D', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_DAU_DO_DO_DAI_CTC', 'Siêu âm đầu dò độ dài CTC', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_2D_TC_BT', 'Siêu âm 2D TC-BT', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_4D_TC_BT', 'Siêu âm 4D TC-BT', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_BOM_NUOC_TU_CUNG', 'Siêu âm bơm nước tử cung', 'dich_vu', 'Thai', NULL),
  ('CLS_SIEU_AM_VU', 'Siêu âm vú', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_TUYEN_GIAP', 'Siêu âm tuyến giáp', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_O_BUNG', 'Siêu âm ổ bụng', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_DOPPLER_MACH_CANH', 'Siêu âm doppler mạch cảnh', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_DOPPLER_DM_THAN', 'Siêu âm doppler ĐM thận', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_DOPPLER_AM_VAT', 'Siêu âm doppler âm vật', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_3D_SAN_CHAU', 'Siêu âm 3D sàn chậu', 'dich_vu', 'Nội tiết – phụ khoa', NULL),
  ('CLS_SIEU_AM_KHOP', 'Siêu âm khớp', 'dich_vu', 'Nội tiết – phụ khoa', NULL)
ON CONFLICT ("group", service_code) DO NOTHING;

COMMIT;
