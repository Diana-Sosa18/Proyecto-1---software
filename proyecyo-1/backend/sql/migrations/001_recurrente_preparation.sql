-- Fase 0. MySQL 8.4. Additive and re-runnable; never execute init.sql to upgrade.
-- Apply after the existing core schema and TRANSACCION_SIMULADA exist.
-- Add reference keys without rewriting existing amounts or rows. Prepared SQL makes
-- index creation re-runnable on MySQL 8.4, which has no ADD INDEX IF NOT EXISTS.
SET @nexus_quota_index_exists = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'CUOTA' AND index_name = 'uq_cuota_casa_recurrente');
SET @nexus_index_sql = IF(@nexus_quota_index_exists = 0,
  'ALTER TABLE CUOTA ADD UNIQUE KEY uq_cuota_casa_recurrente (id_cuota, id_casa)', 'SELECT 1');
PREPARE nexus_index_statement FROM @nexus_index_sql;
EXECUTE nexus_index_statement;
DEALLOCATE PREPARE nexus_index_statement;
SET @nexus_payment_index_exists = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'PAGO' AND index_name = 'uq_pago_cuota_recurrente');
SET @nexus_index_sql = IF(@nexus_payment_index_exists = 0,
  'ALTER TABLE PAGO ADD UNIQUE KEY uq_pago_cuota_recurrente (id_pago, id_cuota)', 'SELECT 1');
PREPARE nexus_index_statement FROM @nexus_index_sql;
EXECUTE nexus_index_statement;
DEALLOCATE PREPARE nexus_index_statement;

CREATE TABLE IF NOT EXISTS PAGO_ORIGEN (
  id_pago INT PRIMARY KEY,
  id_cuota INT NOT NULL,
  origen VARCHAR(12) NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  creado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_pago_ambiente_cuota (id_pago, ambiente, id_cuota),
  FOREIGN KEY (id_pago, id_cuota) REFERENCES PAGO(id_pago, id_cuota),
  CHECK ((origen = 'HISTORICO' AND ambiente = 'historical')
      OR (origen = 'SIMULADO' AND ambiente = 'academic')
      OR (origen = 'RECURRENTE' AND ambiente IN ('sandbox', 'production')))
) ENGINE=InnoDB;

-- Classify existing records without modifying PAGO or inventing provider operations.
INSERT INTO PAGO_ORIGEN (id_pago, id_cuota, origen, ambiente)
SELECT p.id_pago, p.id_cuota,
  CASE WHEN t.id_pago IS NULL THEN 'HISTORICO' ELSE 'SIMULADO' END,
  CASE WHEN t.id_pago IS NULL THEN 'historical' ELSE 'academic' END
FROM PAGO p LEFT JOIN TRANSACCION_SIMULADA t ON t.id_pago = p.id_pago
LEFT JOIN PAGO_ORIGEN o ON o.id_pago = p.id_pago
WHERE o.id_pago IS NULL;

CREATE TABLE IF NOT EXISTS CHECKOUT_RECURRENTE (
  id_checkout BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  referencia_local CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_cuota INT NOT NULL,
  id_usuario INT NOT NULL,
  id_residente INT NULL,
  id_casa INT NOT NULL,
  monto_centavos BIGINT UNSIGNED NOT NULL,
  capital_centavos BIGINT UNSIGNED NOT NULL,
  recargo_centavos BIGINT UNSIGNED NOT NULL,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'CREADO',
  creado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  expira_en DATETIME(6) NULL,
  UNIQUE KEY uq_checkout_referencia (referencia_local),
  UNIQUE KEY uq_checkout_externo (ambiente, id_externo),
  UNIQUE KEY uq_checkout_idempotencia (ambiente, idempotency_key),
  UNIQUE KEY uq_checkout_vinculo (id_checkout, ambiente, id_cuota, id_usuario, id_casa, moneda),
  FOREIGN KEY (id_cuota, id_casa) REFERENCES CUOTA(id_cuota, id_casa),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  FOREIGN KEY (id_residente) REFERENCES RESIDENTE(id_residente),
  FOREIGN KEY (id_casa) REFERENCES CASA(id_casa),
  CHECK (ambiente IN ('sandbox', 'production')),
  CHECK (estado IN ('CREADO', 'PENDIENTE', 'CONFIRMADO', 'FALLIDO', 'CANCELADO', 'EXPIRADO')),
  CHECK (monto_centavos > 0 AND monto_centavos <= 9007199254740991),
  CHECK (monto_centavos = capital_centavos + recargo_centavos),
  CHECK (moneda REGEXP '^[A-Z]{3}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS TRANSACCION_RECURRENTE (
  id_transaccion BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_checkout BIGINT UNSIGNED NOT NULL,
  id_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_cuota INT NOT NULL,
  id_usuario INT NOT NULL,
  id_casa INT NOT NULL,
  id_pago INT NULL,
  monto_centavos BIGINT UNSIGNED NOT NULL,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  estado VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
  creado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  confirmado_en DATETIME(6) NULL,
  UNIQUE KEY uq_transaccion_externo (ambiente, id_externo),
  UNIQUE KEY uq_transaccion_idempotencia (ambiente, idempotency_key),
  UNIQUE KEY uq_transaccion_pago (id_pago),
  UNIQUE KEY uq_transaccion_ambiente (id_transaccion, ambiente, moneda),
  FOREIGN KEY (id_checkout, ambiente, id_cuota, id_usuario, id_casa, moneda)
    REFERENCES CHECKOUT_RECURRENTE(id_checkout, ambiente, id_cuota, id_usuario, id_casa, moneda),
  -- An academic or unclassified accounting payment cannot be attached to a real operation.
  FOREIGN KEY (id_pago, ambiente, id_cuota) REFERENCES PAGO_ORIGEN(id_pago, ambiente, id_cuota),
  CHECK (ambiente IN ('sandbox', 'production')),
  CHECK (estado IN ('PENDIENTE', 'CONFIRMADA', 'FALLIDA', 'CANCELADA', 'REEMBOLSADA_PARCIAL', 'REEMBOLSADA')),
  CHECK (monto_centavos > 0 AND monto_centavos <= 9007199254740991),
  CHECK (id_pago IS NULL OR estado IN ('CONFIRMADA', 'REEMBOLSADA_PARCIAL', 'REEMBOLSADA'))
) ENGINE=InnoDB;

-- Store only allowlisted event metadata and a digest; never persist raw card payloads.
CREATE TABLE IF NOT EXISTS EVENTO_RECURRENTE (
  id_evento BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  svix_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  tipo_evento VARCHAR(100) NOT NULL,
  id_operacion_externa VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  hash_body CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  estado VARCHAR(16) NOT NULL DEFAULT 'RECIBIDO',
  intentos INT UNSIGNED NOT NULL DEFAULT 0,
  error_codigo VARCHAR(80) NULL,
  error_sanitizado VARCHAR(500) NULL,
  recibido_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  procesado_en DATETIME(6) NULL,
  proximo_reintento_en DATETIME(6) NULL,
  UNIQUE KEY uq_evento_svix_ambiente (ambiente, svix_id),
  INDEX idx_evento_reintento (estado, proximo_reintento_en),
  CHECK (ambiente IN ('sandbox', 'production')),
  CHECK (estado IN ('RECIBIDO', 'PROCESANDO', 'PROCESADO', 'FALLIDO', 'IGNORADO'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS REEMBOLSO_RECURRENTE (
  id_reembolso BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_transaccion BIGINT UNSIGNED NOT NULL,
  id_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_usuario_solicitante INT NOT NULL,
  monto_centavos BIGINT UNSIGNED NOT NULL,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  tipo VARCHAR(7) NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'SOLICITADO',
  error_codigo VARCHAR(80) NULL,
  error_sanitizado VARCHAR(500) NULL,
  creado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  confirmado_en DATETIME(6) NULL,
  UNIQUE KEY uq_reembolso_externo (ambiente, id_externo),
  UNIQUE KEY uq_reembolso_idempotencia (ambiente, idempotency_key),
  FOREIGN KEY (id_transaccion, ambiente, moneda)
    REFERENCES TRANSACCION_RECURRENTE(id_transaccion, ambiente, moneda),
  FOREIGN KEY (id_usuario_solicitante) REFERENCES USUARIO(id_usuario),
  CHECK (monto_centavos > 0 AND monto_centavos <= 9007199254740991),
  CHECK (ambiente IN ('sandbox', 'production')),
  CHECK (tipo IN ('PARCIAL', 'TOTAL')),
  CHECK (estado IN ('SOLICITADO', 'PENDIENTE', 'CONFIRMADO', 'FALLIDO', 'CANCELADO'))
) ENGINE=InnoDB;
