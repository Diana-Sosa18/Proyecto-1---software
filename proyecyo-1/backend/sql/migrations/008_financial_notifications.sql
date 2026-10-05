-- HU19. Additive, re-runnable, without historical financial backfill.
-- The quota parent lock serializes cycle changes with HU14/HU18 and jobs.
SET @nexus_notification_user_key_exists = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=DATABASE() AND table_name='NOTIFICACION' AND index_name='uq_notification_user_hu19');
SET @nexus_notification_key_sql = IF(@nexus_notification_user_key_exists=0,
  'ALTER TABLE NOTIFICACION ADD UNIQUE KEY uq_notification_user_hu19 (id_notificacion,id_usuario)', 'SELECT 1');
PREPARE nexus_notification_key_statement FROM @nexus_notification_key_sql;
EXECUTE nexus_notification_key_statement;
DEALLOCATE PREPARE nexus_notification_key_statement;

CREATE TABLE IF NOT EXISTS CICLO_NOTIFICACION_CUOTA (
  id_cuota INT PRIMARY KEY,
  ciclo BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (id_cuota) REFERENCES CUOTA(id_cuota)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ENTREGA_NOTIFICACION_FINANCIERA (
  id_entrega BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  dedup_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_usuario INT NOT NULL,
  id_cuota INT NULL,
  id_pago INT NULL,
  referencia_intento VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  id_reembolso BIGINT UNSIGNED NULL,
  tipo_evento VARCHAR(30) NOT NULL,
  ciclo BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ventana VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  fecha_objetivo DATE NULL,
  fecha_vencimiento DATE NULL,
  fecha_entrega DATE NULL,
  monto_centavos BIGINT UNSIGNED NOT NULL,
  saldo_centavos BIGINT UNSIGNED NULL,
  recargo_centavos BIGINT UNSIGNED NULL,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GTQ',
  ambiente VARCHAR(10) NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje VARCHAR(255) NOT NULL,
  accion_codigo VARCHAR(30) NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
  intentos INT UNSIGNED NOT NULL DEFAULT 0,
  error_codigo VARCHAR(64) NULL,
  creado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  proximo_reintento_en DATETIME(6) NULL,
  entregado_en DATETIME(6) NULL,
  id_notificacion INT NULL,
  UNIQUE KEY uq_entrega_dedup (dedup_key),
  UNIQUE KEY uq_entrega_notificacion (id_notificacion),
  KEY ix_entrega_pendiente (estado,proximo_reintento_en,id_entrega),
  KEY ix_entrega_cuota (id_cuota,ciclo,tipo_evento,fecha_objetivo),
  KEY ix_entrega_usuario (id_usuario,estado),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  FOREIGN KEY (id_cuota) REFERENCES CUOTA(id_cuota),
  FOREIGN KEY (id_pago,id_cuota) REFERENCES PAGO(id_pago,id_cuota),
  FOREIGN KEY (id_reembolso) REFERENCES REEMBOLSO_RECURRENTE(id_reembolso),
  FOREIGN KEY (id_notificacion,id_usuario) REFERENCES NOTIFICACION(id_notificacion,id_usuario),
  CHECK (tipo_evento IN ('PAGO_CONFIRMADO','PAGO_NO_COMPLETADO','PAGO_CANCELADO','REEMBOLSO_CONFIRMADO',
    'CUOTA_PROXIMA','CUOTA_HOY','CUOTA_VENCIDA')),
  CHECK (estado IN ('PENDIENTE','ENTREGADA','OMITIDA','ERROR')),
  CHECK (accion_codigo IS NULL OR accion_codigo IN ('ESTADO_CUENTA','COMPROBANTE_PAGO')),
  CHECK (moneda='GTQ'),
  CHECK (ambiente IS NULL OR ambiente IN ('sandbox','production')),
  CHECK (monto_centavos <= 9007199254740991),
  CHECK (saldo_centavos IS NULL OR saldo_centavos <= 9007199254740991),
  CHECK (recargo_centavos IS NULL OR recargo_centavos <= 9007199254740991),
  CHECK (tipo_evento <> 'PAGO_CONFIRMADO' OR (id_pago IS NOT NULL AND id_cuota IS NOT NULL AND ambiente IS NOT NULL)),
  CHECK (tipo_evento NOT IN ('PAGO_NO_COMPLETADO','PAGO_CANCELADO') OR (referencia_intento IS NOT NULL AND id_cuota IS NOT NULL AND ambiente IS NOT NULL)),
  CHECK (tipo_evento <> 'REEMBOLSO_CONFIRMADO' OR (id_reembolso IS NOT NULL AND id_pago IS NOT NULL AND id_cuota IS NOT NULL AND ambiente IS NOT NULL)),
  CHECK ((estado='ENTREGADA' AND id_notificacion IS NOT NULL AND entregado_en IS NOT NULL AND fecha_entrega IS NOT NULL)
    OR (estado<>'ENTREGADA' AND id_notificacion IS NULL AND entregado_en IS NULL))
) ENGINE=InnoDB;
