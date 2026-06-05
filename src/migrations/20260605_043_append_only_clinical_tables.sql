-- Migration 043: mở rộng append-only guard (hàm prevent_hard_delete từ 033) sang
-- các bảng HỒ SƠ LÂM SÀNG: clinical_record, visit, lab_result.
--
-- Bối cảnh: 033 mới chặn DELETE/TRUNCATE cho patient + appointment. Nhưng:
--   - clinical_record (nội dung khám: chẩn đoán/lời dặn, soap_*),
--   - visit (lượt khám, kể cả status FINALIZED/AMENDED),
--   - lab_result (kết quả XN, mang cờ an toàn triage_group GROUP_C / is_finalized)
-- CHƯA được bảo vệ → bị xoá VẬT LÝ được, mất audit trail (vi phạm TT13/2011/TT-BYT
-- mà header 017 viện dẫn). Mọi ghi của dashboard đi qua service-role (bypass RLS)
-- nên trigger DB là HÀNG RÀO DUY NHẤT còn hiệu lực khi code lỗi / key rò rỉ.
--
-- PHẠM VI: CHỈ chặn HARD DELETE + TRUNCATE. KHÔNG đụng UPDATE (giữ tự do cho vòng
-- đời + đính chính) và KHÔNG đụng logic cờ an toàn (việc đó thuộc safety-gate, để
-- quyết riêng). ETL sync_to_supabase.py đã set `SET LOCAL app.allow_hard_delete='on'`
-- quanh TRUNCATE-rồi-INSERT (dòng 304) → first-sync KHÔNG bị chặn (cùng escape hatch
-- với 033). Dashboard không set GUC này nên ad-hoc delete vẫn bị chặn.
-- Re-runnable: DROP TRIGGER IF EXISTS trước mỗi CREATE.

BEGIN;

-- clinical_record -----------------------------------------------------------
DROP TRIGGER IF EXISTS trg_clinical_record_no_delete ON clinical_record;
CREATE TRIGGER trg_clinical_record_no_delete
    BEFORE DELETE ON clinical_record
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_clinical_record_no_truncate ON clinical_record;
CREATE TRIGGER trg_clinical_record_no_truncate
    BEFORE TRUNCATE ON clinical_record
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();

-- visit ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_visit_no_delete ON visit;
CREATE TRIGGER trg_visit_no_delete
    BEFORE DELETE ON visit
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_visit_no_truncate ON visit;
CREATE TRIGGER trg_visit_no_truncate
    BEFORE TRUNCATE ON visit
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();

-- lab_result ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_lab_result_no_delete ON lab_result;
CREATE TRIGGER trg_lab_result_no_delete
    BEFORE DELETE ON lab_result
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_lab_result_no_truncate ON lab_result;
CREATE TRIGGER trg_lab_result_no_truncate
    BEFORE TRUNCATE ON lab_result
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();

COMMIT;
