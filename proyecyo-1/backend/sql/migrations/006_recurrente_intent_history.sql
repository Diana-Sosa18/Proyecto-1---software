-- Additive identity/audit extension. No backfill and no changes to existing rows.
-- An aggregated transaction may have several authoritative provider attempts.
CREATE TABLE IF NOT EXISTS INTENTO_RECURRENTE (
  id_intento BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_transaccion BIGINT UNSIGNED NOT NULL,
  id_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_pago_externo VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ambiente VARCHAR(10) NOT NULL,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  monto_centavos BIGINT UNSIGNED NOT NULL,
  estado VARCHAR(16) NOT NULL,
  id_evento BIGINT UNSIGNED NOT NULL,
  fecha_proveedor_original VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  fecha_proveedor_utc DATETIME(6) NULL,
  motivo_codigo VARCHAR(64) NULL,
  motivo_sanitizado VARCHAR(255) NULL,
  registrado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_intento_estado (ambiente,id_externo,estado),
  INDEX idx_intento_transaccion (id_transaccion,registrado_en),
  FOREIGN KEY (id_transaccion,ambiente,moneda) REFERENCES TRANSACCION_RECURRENTE(id_transaccion,ambiente,moneda),
  FOREIGN KEY (id_evento,ambiente) REFERENCES EVENTO_RECURRENTE(id_evento,ambiente),
  CHECK (estado IN ('FALLIDA','CANCELADA','CONFIRMADA')),
  CHECK (ambiente IN ('sandbox','production')),
  CHECK (monto_centavos > 0 AND monto_centavos <= 9007199254740991)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS REVISION_EVENTO_RECURRENTE (
  id_revision BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_evento BIGINT UNSIGNED NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  estado_anterior VARCHAR(16) NOT NULL,
  error_anterior VARCHAR(80) NULL,
  intentos_anteriores INT UNSIGNED NOT NULL,
  procesado_anterior DATETIME(6) NULL,
  operador VARCHAR(64) NOT NULL,
  iniciado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  finalizado_en DATETIME(6) NULL,
  estado_resultante VARCHAR(16) NULL,
  error_resultante VARCHAR(80) NULL,
  UNIQUE KEY uq_revision_intento (id_evento,ambiente,intentos_anteriores),
  FOREIGN KEY (id_evento,ambiente) REFERENCES EVENTO_RECURRENTE(id_evento,ambiente),
  CHECK (ambiente IN ('sandbox','production')),
  CHECK (estado_anterior = 'REVISION'),
  CHECK (estado_resultante IS NULL OR estado_resultante IN ('PROCESADO','REVISION','IGNORADO','FALLIDO'))
) ENGINE=InnoDB;
