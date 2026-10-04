-- Additive evidence for explicit precision repairs. No financial/data backfill.
-- 006 already uses DATETIME(6); keep that applied migration unchanged.
CREATE TABLE IF NOT EXISTS REPARACION_REVISION_RECURRENTE (
  id_reparacion BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_revision BIGINT UNSIGNED NOT NULL,
  id_evento BIGINT UNSIGNED NOT NULL,
  ambiente VARCHAR(10) NOT NULL,
  valor_anterior DATETIME(6) NOT NULL,
  valor_restaurado DATETIME(6) NOT NULL,
  hash_snapshot CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  hash_evento_original CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  operador VARCHAR(64) NOT NULL,
  reparado_en DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_reparacion_revision (id_revision),
  FOREIGN KEY (id_revision) REFERENCES REVISION_EVENTO_RECURRENTE(id_revision),
  FOREIGN KEY (id_evento,ambiente) REFERENCES EVENTO_RECURRENTE(id_evento,ambiente),
  CHECK (ambiente IN ('sandbox','production')),
  CHECK (MOD(MICROSECOND(valor_anterior),1000)=0),
  CHECK (TIMESTAMPDIFF(MICROSECOND,valor_anterior,valor_restaurado) BETWEEN 1 AND 999)
) ENGINE=InnoDB;
