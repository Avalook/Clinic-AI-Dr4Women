-- Rollback T-DASH-PAYMENT-01.
DROP POLICY IF EXISTS payment_select_authenticated ON payment;
DROP TABLE IF EXISTS payment;
