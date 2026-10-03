-- HU15. Additive audit only; no payment/amount/state backfill. MySQL 8.4.
SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='CHECKOUT_RECURRENTE' AND COLUMN_NAME='verificado_en');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE CHECKOUT_RECURRENTE ADD COLUMN verificado_en DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND COLUMN_NAME='id_checkout');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN id_checkout BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND COLUMN_NAME='resultado_intento');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN resultado_intento VARCHAR(16) NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND COLUMN_NAME='motivo_codigo');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN motivo_codigo VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND COLUMN_NAME='motivo_sanitizado');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN motivo_sanitizado VARCHAR(255) NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='TRANSACCION_RECURRENTE' AND COLUMN_NAME='motivo_codigo');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN motivo_codigo VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='TRANSACCION_RECURRENTE' AND COLUMN_NAME='motivo_sanitizado');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN motivo_sanitizado VARCHAR(255) NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='TRANSACCION_RECURRENTE' AND COLUMN_NAME='finalizado_en');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN finalizado_en DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND CONSTRAINT_NAME='fk_evento_checkout_hu15');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD CONSTRAINT fk_evento_checkout_hu15 FOREIGN KEY (id_checkout) REFERENCES CHECKOUT_RECURRENTE(id_checkout)', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='EVENTO_RECURRENTE' AND CONSTRAINT_NAME='chk_evento_intento_hu15');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE EVENTO_RECURRENTE ADD CONSTRAINT chk_evento_intento_hu15 CHECK (resultado_intento IS NULL OR resultado_intento IN (''FALLIDA'',''CANCELADA''))', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='TRANSACCION_RECURRENTE' AND CONSTRAINT_NAME='chk_transaccion_fallo_hu15');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD CONSTRAINT chk_transaccion_fallo_hu15 CHECK (estado NOT IN (''FALLIDA'',''CANCELADA'') OR (id_pago IS NULL AND confirmado_en IS NULL AND capital_aplicado_centavos IS NULL AND recargo_aplicado_centavos IS NULL))', 'SELECT 1');
PREPARE nexus_attempt_statement FROM @nexus_ddl;
EXECUTE nexus_attempt_statement;
DEALLOCATE PREPARE nexus_attempt_statement;
