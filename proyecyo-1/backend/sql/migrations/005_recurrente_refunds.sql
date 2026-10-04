-- HU18. Additive, re-runnable MySQL 8.4 upgrade. Preserve every original row.
-- No financial backfill. Nullable new fields distinguish historical preparation fixtures.
SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='referencia_local');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN referencia_local CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='request_fingerprint');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN request_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='motivo');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN motivo VARCHAR(500) NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='sandbox_id');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN sandbox_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='estado_proveedor');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN estado_proveedor VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='enviado_en');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN enviado_en DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='verificado_en');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN verificado_en DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='fecha_proveedor_original');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN fecha_proveedor_original VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='fecha_proveedor_utc');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN fecha_proveedor_utc DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='fecha_contable');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN fecha_contable DATE NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='aplicado_en');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN aplicado_en DATETIME(6) NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='capital_revertido_centavos');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN capital_revertido_centavos BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='recargo_revertido_centavos');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN recargo_revertido_centavos BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='id_evento');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN id_evento BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='evidencia_confirmacion');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN evidencia_confirmacion VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='importe_comercio_centavos');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN importe_comercio_centavos BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND INDEX_NAME='uq_refund_reference_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD UNIQUE KEY uq_refund_reference_hu18 (referencia_local)', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND CONSTRAINT_NAME='chk_refund_state_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD CONSTRAINT chk_refund_state_hu18 CHECK (estado IN (''SOLICITADO'',''PENDIENTE'',''CONFIRMADO'',''FALLIDO'',''CANCELADO'',''INCIERTO'',''REVISION''))', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND CONSTRAINT_NAME='chk_refund_provider_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD CONSTRAINT chk_refund_provider_hu18 CHECK (estado_proveedor IS NULL OR estado_proveedor IN (''pending'',''succeeded'',''failed'',''voided''))', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND CONSTRAINT_NAME='chk_refund_application_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD CONSTRAINT chk_refund_application_hu18 CHECK ((aplicado_en IS NULL AND capital_revertido_centavos IS NULL AND recargo_revertido_centavos IS NULL) OR (aplicado_en IS NOT NULL AND estado=''CONFIRMADO'' AND confirmado_en IS NOT NULL AND fecha_contable IS NOT NULL AND capital_revertido_centavos IS NOT NULL AND recargo_revertido_centavos IS NOT NULL AND monto_centavos=capital_revertido_centavos+recargo_revertido_centavos))', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND CONSTRAINT_NAME='chk_refund_evidence_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD CONSTRAINT chk_refund_evidence_hu18 CHECK (evidencia_confirmacion IS NULL OR evidencia_confirmacion IN (''POST'',''GET'',''WEBHOOK''))', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND CONSTRAINT_NAME='fk_refund_event_hu18');
SET @nexus_ddl = IF(@nexus_exists=0, 'ALTER TABLE REEMBOLSO_RECURRENTE ADD CONSTRAINT fk_refund_event_hu18 FOREIGN KEY (id_evento,ambiente) REFERENCES EVENTO_RECURRENTE(id_evento,ambiente)', 'SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_old_check = (SELECT cc.CONSTRAINT_NAME FROM information_schema.CHECK_CONSTRAINTS cc JOIN information_schema.TABLE_CONSTRAINTS tc USING(CONSTRAINT_SCHEMA,CONSTRAINT_NAME) WHERE cc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='REEMBOLSO_RECURRENTE' AND CHECK_CLAUSE LIKE '%SOLICITADO%' AND CHECK_CLAUSE NOT LIKE '%INCIERTO%' LIMIT 1);
SET @nexus_ddl = IF(@nexus_old_check IS NULL, 'SELECT 1', CONCAT('ALTER TABLE REEMBOLSO_RECURRENTE DROP CHECK `', REPLACE(@nexus_old_check,'`','``'), '`'));
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;

SET @nexus_exists=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='REEMBOLSO_RECURRENTE' AND COLUMN_NAME='cuenta_proveedor');
SET @nexus_ddl=IF(@nexus_exists=0,'ALTER TABLE REEMBOLSO_RECURRENTE ADD COLUMN cuenta_proveedor VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL','SELECT 1');
PREPARE nexus_refund_statement FROM @nexus_ddl;
EXECUTE nexus_refund_statement;
DEALLOCATE PREPARE nexus_refund_statement;
