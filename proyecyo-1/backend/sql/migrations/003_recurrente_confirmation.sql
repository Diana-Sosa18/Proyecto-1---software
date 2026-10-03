-- HU14. Additive, repeatable audit fields and inbox review state. No row deletion.
SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EVENTO_RECURRENTE' AND COLUMN_NAME = 'sandbox_id');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN sandbox_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EVENTO_RECURRENTE' AND COLUMN_NAME = 'live_mode');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE EVENTO_RECURRENTE ADD COLUMN live_mode BOOLEAN NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'id_pago_externo');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN id_pago_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'id_evento');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN id_evento BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'fecha_proveedor_utc');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN fecha_proveedor_utc DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'fecha_proveedor_original');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN fecha_proveedor_original VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'capital_aplicado_centavos');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN capital_aplicado_centavos BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND COLUMN_NAME = 'recargo_aplicado_centavos');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD COLUMN recargo_aplicado_centavos BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EVENTO_RECURRENTE' AND INDEX_NAME = 'uq_evento_ambiente');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE EVENTO_RECURRENTE ADD UNIQUE KEY uq_evento_ambiente (id_evento, ambiente)', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND INDEX_NAME = 'uq_transaccion_pago_externo');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD UNIQUE KEY uq_transaccion_pago_externo (ambiente, id_pago_externo)', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND CONSTRAINT_NAME = 'fk_transaccion_evento_hu14');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD CONSTRAINT fk_transaccion_evento_hu14 FOREIGN KEY (id_evento, ambiente) REFERENCES EVENTO_RECURRENTE(id_evento, ambiente)', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'TRANSACCION_RECURRENTE' AND CONSTRAINT_NAME = 'chk_transaccion_aplicacion_hu14');
SET @nexus_ddl = IF(@nexus_exists = 0, 'ALTER TABLE TRANSACCION_RECURRENTE ADD CONSTRAINT chk_transaccion_aplicacion_hu14 CHECK ((capital_aplicado_centavos IS NULL AND recargo_aplicado_centavos IS NULL) OR (capital_aplicado_centavos IS NOT NULL AND recargo_aplicado_centavos IS NOT NULL AND monto_centavos = capital_aplicado_centavos + recargo_aplicado_centavos))', 'SELECT 1');
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;

-- Atomically widen the existing state CHECK; every previously valid state remains valid.
SET @nexus_old_check = (SELECT tc.CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='EVENTO_RECURRENTE'
    AND tc.CONSTRAINT_TYPE='CHECK' AND cc.CHECK_CLAUSE LIKE '%estado%' AND cc.CHECK_CLAUSE NOT LIKE '%REVISION%' LIMIT 1);
SET @nexus_ddl = IF(@nexus_old_check IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE EVENTO_RECURRENTE DROP CHECK `', @nexus_old_check,
    '`, ADD CONSTRAINT chk_evento_estado_hu14 CHECK (estado IN (''RECIBIDO'',''PROCESANDO'',''PROCESADO'',''FALLIDO'',''IGNORADO'',''REVISION''))'));
PREPARE nexus_webhook_statement FROM @nexus_ddl;
EXECUTE nexus_webhook_statement;
DEALLOCATE PREPARE nexus_webhook_statement;
