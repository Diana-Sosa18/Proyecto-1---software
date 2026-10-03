-- HU13. Incremental, re-runnable checkout metadata; preserves existing rows.
SET @nexus_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND COLUMN_NAME = 'checkout_url');
SET @nexus_ddl = IF(@nexus_column_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD COLUMN checkout_url VARCHAR(2048) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

SET @nexus_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND COLUMN_NAME = 'sandbox_id');
SET @nexus_ddl = IF(@nexus_column_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD COLUMN sandbox_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

SET @nexus_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND COLUMN_NAME = 'estado_proveedor');
SET @nexus_ddl = IF(@nexus_column_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD COLUMN estado_proveedor VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

SET @nexus_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND COLUMN_NAME = 'error_codigo');
SET @nexus_ddl = IF(@nexus_column_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD COLUMN error_codigo VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

-- Widen only the old state CHECK, atomically in one ALTER. Never delete an existing row.
SET @nexus_old_state_check = (SELECT tc.CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS tc
  INNER JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'CHECKOUT_RECURRENTE'
    AND tc.CONSTRAINT_TYPE = 'CHECK' AND cc.CHECK_CLAUSE LIKE '%estado%'
    AND cc.CHECK_CLAUSE NOT LIKE '%INCIERTO%' AND cc.CHECK_CLAUSE NOT LIKE '%estado_proveedor%'
  LIMIT 1);
SET @nexus_ddl = IF(@nexus_old_state_check IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE CHECKOUT_RECURRENTE DROP CHECK `', @nexus_old_state_check,
    '`, ADD CONSTRAINT chk_checkout_estado_hu13 CHECK (estado IN (''CREADO'', ''PENDIENTE'', ''CONFIRMADO'', ''FALLIDO'', ''CANCELADO'', ''EXPIRADO'', ''INCIERTO''))'));
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

SET @nexus_provider_check_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND CONSTRAINT_NAME = 'chk_checkout_provider_hu13');
SET @nexus_ddl = IF(@nexus_provider_check_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD CONSTRAINT chk_checkout_provider_hu13 CHECK (estado_proveedor IS NULL OR estado_proveedor IN (''unpaid'', ''paid'', ''payment_in_progress'', ''expired''))', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;

SET @nexus_checkout_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CHECKOUT_RECURRENTE' AND INDEX_NAME = 'idx_checkout_cuota_estado');
SET @nexus_ddl = IF(@nexus_checkout_index_exists = 0,
  'ALTER TABLE CHECKOUT_RECURRENTE ADD INDEX idx_checkout_cuota_estado (id_cuota, estado)', 'SELECT 1');
PREPARE nexus_checkout_statement FROM @nexus_ddl;
EXECUTE nexus_checkout_statement;
DEALLOCATE PREPARE nexus_checkout_statement;
