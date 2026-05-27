const mysql = require("mysql2/promise");

const { env } = require("../config/env");

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function tableExists(tableName) {
  const rows = await query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [env.DB_NAME, tableName],
  );

  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [env.DB_NAME, tableName, columnName],
  );

  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [env.DB_NAME, tableName, indexName],
  );

  return rows.length > 0;
}

async function ensureVisitQrSchema() {
  const hasTokenQr = await columnExists("ACCESO", "token_qr");
  const hasEstadoAcceso = await columnExists("ACCESO", "estado_acceso");
  const hasAuthorizer = await columnExists("ACCESO", "id_usuario_autoriza");
  const hasServiceReason = await columnExists("ACCESO", "motivo_servicio");
  const hasObservations = await columnExists("ACCESO", "observaciones");

  if (!hasTokenQr) {
    await query(`
      ALTER TABLE ACCESO
      ADD COLUMN token_qr VARCHAR(64) NULL
    `);
  }

  if (!hasEstadoAcceso) {
    await query(`
      ALTER TABLE ACCESO
      ADD COLUMN estado_acceso VARCHAR(30) NOT NULL DEFAULT 'AUTORIZADA'
    `);
  }

  if (!hasAuthorizer) {
    await query(`
      ALTER TABLE ACCESO
      ADD COLUMN id_usuario_autoriza INT NULL AFTER id_casa
    `);
  }

  if (!hasServiceReason) {
    await query(`
      ALTER TABLE ACCESO
      ADD COLUMN motivo_servicio VARCHAR(120) NULL AFTER tipo_visita
    `);
  }

  if (!hasObservations) {
    await query(`
      ALTER TABLE ACCESO
      ADD COLUMN observaciones VARCHAR(255) NULL AFTER motivo_servicio
    `);
  }

  await query(`
    UPDATE ACCESO
    SET token_qr = REPLACE(UUID(), '-', '')
    WHERE token_qr IS NULL OR token_qr = ''
  `);

  await query(`
    UPDATE ACCESO
    SET estado_acceso = 'AUTORIZADA'
    WHERE estado_acceso IS NULL OR estado_acceso = ''
  `);

  const hasTokenQrIndex = await indexExists("ACCESO", "uq_acceso_token_qr");

  if (!hasTokenQrIndex) {
    await query(`
      ALTER TABLE ACCESO
      ADD CONSTRAINT uq_acceso_token_qr UNIQUE (token_qr)
    `);
  }
}

async function ensureAmenityReservationsSchema() {
  const amenityColumns = [
    {
      column: "descripcion",
      ddl: `
        ALTER TABLE AMENIDAD
        ADD COLUMN descripcion VARCHAR(200) NULL AFTER nombre
      `,
    },
    {
      column: "hora_apertura",
      ddl: `
        ALTER TABLE AMENIDAD
        ADD COLUMN hora_apertura TIME NOT NULL DEFAULT '08:00:00' AFTER descripcion
      `,
    },
    {
      column: "hora_cierre",
      ddl: `
        ALTER TABLE AMENIDAD
        ADD COLUMN hora_cierre TIME NOT NULL DEFAULT '22:00:00' AFTER hora_apertura
      `,
    },
    {
      column: "intervalo_minutos",
      ddl: `
        ALTER TABLE AMENIDAD
        ADD COLUMN intervalo_minutos INT NOT NULL DEFAULT 60 AFTER hora_cierre
      `,
    },
    {
      column: "activo",
      ddl: `
        ALTER TABLE AMENIDAD
        ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE AFTER intervalo_minutos
      `,
    },
  ];

  for (const definition of amenityColumns) {
    if (!(await columnExists("AMENIDAD", definition.column))) {
      await query(definition.ddl);
    }
  }

  const reservationColumns = [
    {
      column: "estado",
      ddl: `
        ALTER TABLE RESERVA
        ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' AFTER hora_fin
      `,
    },
    {
      column: "creado_en",
      ddl: `
        ALTER TABLE RESERVA
        ADD COLUMN creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER estado
      `,
    },
  ];

  for (const definition of reservationColumns) {
    if (!(await columnExists("RESERVA", definition.column))) {
      await query(definition.ddl);
    }
  }

  await query(`
    UPDATE AMENIDAD
    SET
      hora_apertura = COALESCE(hora_apertura, '08:00:00'),
      hora_cierre = COALESCE(hora_cierre, '22:00:00'),
      intervalo_minutos = COALESCE(intervalo_minutos, 60),
      activo = COALESCE(activo, 1)
  `);

  await query(`
    UPDATE RESERVA
    SET estado = 'CONFIRMADA'
    WHERE estado IS NULL OR estado = ''
  `);

  if (!(await indexExists("RESERVA", "idx_reserva_amenidad_fecha_horario"))) {
    await query(`
      ALTER TABLE RESERVA
      ADD INDEX idx_reserva_amenidad_fecha_horario (id_amenidad, fecha, hora_inicio, hora_fin)
    `);
  }
}

async function ensureNotificationsSchema() {
  if (!(await tableExists("NOTIFICACION"))) {
    await query(`
      CREATE TABLE NOTIFICACION (
        id_notificacion INT PRIMARY KEY AUTO_INCREMENT,
        id_usuario INT NOT NULL,
        id_acceso INT NULL,
        tipo VARCHAR(50) NOT NULL DEFAULT 'LLEGADA_VISITA',
        titulo VARCHAR(150) NOT NULL,
        mensaje VARCHAR(255) NOT NULL,
        leido BOOLEAN NOT NULL DEFAULT FALSE,
        creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        leido_en DATETIME NULL,
        FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
        FOREIGN KEY (id_acceso) REFERENCES ACCESO(id_acceso) ON DELETE SET NULL
      )
    `);
  }

  if (!(await indexExists("NOTIFICACION", "idx_notificacion_usuario_leido"))) {
    await query(`
      ALTER TABLE NOTIFICACION
      ADD INDEX idx_notificacion_usuario_leido (id_usuario, leido, creado_en)
    `);
  }
}

async function ensureTenantProvidersSchema() {
  const serviceColumns = [
    {
      column: "tipo_servicio",
      ddl: `
        ALTER TABLE SERVICIO
        ADD COLUMN tipo_servicio VARCHAR(60) NOT NULL DEFAULT 'General' AFTER nombre
      `,
    },
    {
      column: "descripcion",
      ddl: `
        ALTER TABLE SERVICIO
        ADD COLUMN descripcion VARCHAR(200) NULL AFTER tipo_servicio
      `,
    },
  ];

  for (const definition of serviceColumns) {
    if (!(await columnExists("SERVICIO", definition.column))) {
      await query(definition.ddl);
    }
  }

  const houseServiceColumns = [
    {
      column: "fecha_registro",
      ddl: `
        ALTER TABLE CASA_SERVICIO
        ADD COLUMN fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      `,
    },
    {
      column: "actualizado_en",
      ddl: `
        ALTER TABLE CASA_SERVICIO
        ADD COLUMN actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      `,
    },
    {
      column: "activo",
      ddl: `
        ALTER TABLE CASA_SERVICIO
        ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE
      `,
    },
    {
      column: "estado_validacion",
      ddl: `
        ALTER TABLE CASA_SERVICIO
        ADD COLUMN estado_validacion VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
      `,
    },
  ];

  for (const definition of houseServiceColumns) {
    if (!(await columnExists("CASA_SERVICIO", definition.column))) {
      await query(definition.ddl);
    }
  }

  await query(`
    UPDATE CASA_SERVICIO
    SET
      estado_validacion = COALESCE(NULLIF(estado_validacion, ''), 'PENDIENTE'),
      fecha_registro = COALESCE(fecha_registro, CURRENT_TIMESTAMP),
      actualizado_en = COALESCE(actualizado_en, CURRENT_TIMESTAMP)
    WHERE estado_validacion IS NULL
      OR estado_validacion = ''
      OR fecha_registro IS NULL
      OR actualizado_en IS NULL
  `);

  if (!(await tableExists("HISTORIAL_CAMBIO_PROVEEDOR"))) {
    await query(`
      CREATE TABLE HISTORIAL_CAMBIO_PROVEEDOR (
        id_historial INT PRIMARY KEY AUTO_INCREMENT,
        id_casa INT NOT NULL,
        id_servicio INT NOT NULL,
        accion VARCHAR(40) NOT NULL,
        detalle VARCHAR(255) NOT NULL,
        activo_anterior BOOLEAN NULL,
        activo_nuevo BOOLEAN NULL,
        estado_anterior VARCHAR(20) NULL,
        estado_nuevo VARCHAR(20) NULL,
        realizado_por_usuario INT NOT NULL,
        realizado_por_nombre VARCHAR(100) NOT NULL,
        realizado_por_rol VARCHAR(40) NOT NULL,
        creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_casa) REFERENCES CASA(id_casa),
        FOREIGN KEY (id_servicio) REFERENCES SERVICIO(id_servicio),
        FOREIGN KEY (realizado_por_usuario) REFERENCES USUARIO(id_usuario)
      )
    `);
  }

  const serviceRows = await query("SELECT COUNT(*) AS total FROM SERVICIO");

  if (Number(serviceRows[0]?.total || 0) === 0) {
    await query(`
      INSERT INTO SERVICIO (nombre, tipo_servicio, descripcion)
      VALUES
        ('Energia electrica', 'Basico', 'Suministro electrico asociado a la unidad residencial.'),
        ('Agua potable', 'Basico', 'Servicio de agua potable y control de consumo mensual.'),
        ('Internet residencial', 'Telecomunicaciones', 'Proveedor de conectividad para la vivienda.'),
        ('Limpieza y mantenimiento', 'Mantenimiento', 'Servicio programado de limpieza para areas de apoyo.'),
        ('Seguridad privada', 'Seguridad', 'Servicio adicional de control y monitoreo residencial.')
    `);
  }

  await query(`
    INSERT IGNORE INTO CASA_SERVICIO (id_casa, id_servicio, activo, estado_validacion)
    SELECT c.id_casa, s.id_servicio, TRUE, 'VALIDADO'
    FROM CASA c
    INNER JOIN SERVICIO s
      ON s.nombre IN ('Energia electrica', 'Agua potable', 'Seguridad privada')
  `);
}

async function ensureAnnouncementsSchema() {
  if (!(await tableExists("COMUNICADO"))) {
    await query(`
      CREATE TABLE COMUNICADO (
        id_comunicado INT PRIMARY KEY AUTO_INCREMENT,
        titulo VARCHAR(200),
        descripcion TEXT,
        fecha DATE,
        creado_por INT,
        tipo_destinatario VARCHAR(20) NOT NULL DEFAULT 'todos',
        enviado_en DATETIME NULL,
        total_destinatarios INT NOT NULL DEFAULT 0,
        FOREIGN KEY (creado_por) REFERENCES USUARIO(id_usuario)
      )
    `);
  }

  if (!(await tableExists("COMUNICADO_USUARIO"))) {
    await query(`
      CREATE TABLE COMUNICADO_USUARIO (
        id_comunicado INT,
        id_usuario INT,
        leido BOOLEAN,
        PRIMARY KEY (id_comunicado, id_usuario),
        FOREIGN KEY (id_comunicado) REFERENCES COMUNICADO(id_comunicado),
        FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
      )
    `);
  }

  const comunicadoColumns = [
    {
      column: "tipo_destinatario",
      ddl: `
        ALTER TABLE COMUNICADO
        ADD COLUMN tipo_destinatario VARCHAR(20) NOT NULL DEFAULT 'todos' AFTER creado_por
      `,
    },
    {
      column: "enviado_en",
      ddl: `
        ALTER TABLE COMUNICADO
        ADD COLUMN enviado_en DATETIME NULL AFTER tipo_destinatario
      `,
    },
    {
      column: "total_destinatarios",
      ddl: `
        ALTER TABLE COMUNICADO
        ADD COLUMN total_destinatarios INT NOT NULL DEFAULT 0 AFTER enviado_en
      `,
    },
  ];

  for (const definition of comunicadoColumns) {
    if (!(await columnExists("COMUNICADO", definition.column))) {
      await query(definition.ddl);
    }
  }
}

async function ensureSpecialAccessSchema() {
  const accessColumns = [
    {
      column: "motivo_excepcion",
      ddl: `
        ALTER TABLE ACCESO
        ADD COLUMN motivo_excepcion VARCHAR(255) NULL AFTER observaciones
      `,
    },
    {
      column: "es_acceso_especial",
      ddl: `
        ALTER TABLE ACCESO
        ADD COLUMN es_acceso_especial BOOLEAN NOT NULL DEFAULT FALSE AFTER estado_acceso
      `,
    },
    {
      column: "fuera_horario",
      ddl: `
        ALTER TABLE ACCESO
        ADD COLUMN fuera_horario BOOLEAN NOT NULL DEFAULT FALSE AFTER es_acceso_especial
      `,
    },
  ];

  for (const definition of accessColumns) {
    if (!(await columnExists("ACCESO", definition.column))) {
      await query(definition.ddl);
    }
  }

  if (!(await tableExists("ACCESO_EXCEPCION"))) {
    await query(`
      CREATE TABLE ACCESO_EXCEPCION (
        id_excepcion INT PRIMARY KEY AUTO_INCREMENT,
        id_acceso INT NOT NULL,
        aprobado_por INT NOT NULL,
        motivo TEXT,
        hora_solicitada_inicio TIME,
        hora_solicitada_fin TIME,
        accion VARCHAR(20) NOT NULL,
        creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_acceso) REFERENCES ACCESO(id_acceso),
        FOREIGN KEY (aprobado_por) REFERENCES USUARIO(id_usuario),
        CHECK (accion IN ('APROBADO', 'RECHAZADO'))
      )
    `);
  }

  const configRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM CONFIGURACION
      WHERE clave IN ('horario_visita_inicio', 'horario_visita_fin')
    `,
  );

  if (Number(configRows[0]?.total || 0) < 2) {
    await query(`
      INSERT IGNORE INTO CONFIGURACION (clave, valor)
      VALUES
        ('horario_visita_inicio', '06:00'),
        ('horario_visita_fin', '22:00')
    `);
  }
}

module.exports = {
  pool,
  query,
  ensureVisitQrSchema,
  ensureAmenityReservationsSchema,
  ensureNotificationsSchema,
  ensureTenantProvidersSchema,
  ensureAnnouncementsSchema,
  ensureSpecialAccessSchema,
};
