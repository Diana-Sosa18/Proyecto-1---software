const { pool, query } = require("../database/mysql");

const RESIDENTIAL_TIMEZONE = "America/Guatemala";
const REMINDER_TYPES = ["PROXIMO_VENCIMIENTO", "VENCIDO"];
const NOTIFICATION_TYPE = "RECORDATORIO_PAGO";

const CONFIG_KEYS = {
  activo: "recordatorios_activo",
  dias_antes: "recordatorios_dias_antes",
};

const DEFAULT_CONFIG = {
  activo: true,
  dias_antes: 3,
};

function normalizeString(value) {
  return String(value || "").trim();
}

function getCurrentDateInTimezone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESIDENTIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeReminderType(value) {
  const normalized = normalizeString(value).toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  if (!REMINDER_TYPES.includes(normalized)) {
    const error = new Error("El tipo de recordatorio es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function normalizeDaysBefore(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 60) {
    const error = new Error("Los dias de anticipacion deben estar entre 0 y 60.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

function buildHouseLabel(row) {
  const tower = normalizeString(row.torre);
  const number = normalizeString(row.numero);

  return tower ? `${tower}-${number}` : number;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function buildReminderTemplate({ tipo, servicio, monto, fecha_limite, dias_para_vencer }) {
  const montoTexto = `Q${formatCurrency(monto)}`;
  const servicioTexto = servicio ? ` de ${servicio}` : "";

  if (tipo === "VENCIDO") {
    const diasVencida = Math.abs(Number(dias_para_vencer || 0));
    const plural = diasVencida === 1 ? "dia" : "dias";

    return {
      titulo: "Pago vencido pendiente",
      mensaje: `Su cuota${servicioTexto} por ${montoTexto} vencio el ${fecha_limite} (hace ${diasVencida} ${plural}). Regularice su pago para evitar recargos.`,
    };
  }

  const dias = Number(dias_para_vencer || 0);
  const cuando = dias <= 0 ? "vence hoy" : dias === 1 ? "vence manana" : `vence en ${dias} dias`;

  return {
    titulo: "Recordatorio de pago proximo",
    mensaje: `Su cuota${servicioTexto} por ${montoTexto} ${cuando} (${fecha_limite}). Realice su pago a tiempo para mantenerse al dia.`,
  };
}

function mapReminder(row) {
  return {
    id_recordatorio: Number(row.id_recordatorio),
    casa_unidad: buildHouseLabel(row),
    residente: row.residente,
    correo: row.correo || null,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    monto: Number(row.monto || 0),
    fecha_limite: row.fecha_limite,
    dias_para_vencer: Number(row.dias_para_vencer || 0),
    servicio: row.servicio || null,
    enviado_en: row.enviado_en,
  };
}

async function getReminderConfig() {
  const rows = await query("SELECT clave, valor FROM CONFIGURACION WHERE clave IN (?, ?)", [
    CONFIG_KEYS.activo,
    CONFIG_KEYS.dias_antes,
  ]);
  const map = Object.fromEntries(rows.map((row) => [row.clave, row.valor]));

  return {
    activo: map[CONFIG_KEYS.activo] == null ? DEFAULT_CONFIG.activo : map[CONFIG_KEYS.activo] === "true",
    dias_antes:
      map[CONFIG_KEYS.dias_antes] == null
        ? DEFAULT_CONFIG.dias_antes
        : normalizeDaysBefore(map[CONFIG_KEYS.dias_antes]),
  };
}

async function saveReminderConfig(payload = {}) {
  const activo = Boolean(payload.activo);
  const diasAntes = normalizeDaysBefore(payload.dias_antes);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO CONFIGURACION (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
      [CONFIG_KEYS.activo, activo ? "true" : "false"],
    );
    await connection.execute(
      "INSERT INTO CONFIGURACION (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
      [CONFIG_KEYS.dias_antes, String(diasAntes)],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { activo, dias_antes: diasAntes };
}

async function sendPaymentReminders(userId) {
  const config = await getReminderConfig();
  const currentDate = getCurrentDateInTimezone();

  if (!config.activo) {
    return { enviados: 0, fecha_revision: currentDate, activo: false };
  }

  const pendingQuotas = await query(
    `
      SELECT
        cu.id_cuota,
        cu.id_casa,
        cu.monto AS cuota_monto,
        DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        DATEDIFF(cu.fecha_limite, ?) AS dias_para_vencer,
        srv.nombre AS servicio,
        propietario.id_usuario AS id_usuario,
        GREATEST(cu.monto - COALESCE(pagos.total_pagado, 0), 0) AS saldo
      FROM CUOTA cu
      INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      INNER JOIN CASA c ON c.id_casa = cu.id_casa
      INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente
      INNER JOIN USUARIO propietario ON propietario.id_usuario = r.id_usuario
      LEFT JOIN (
        SELECT id_cuota, SUM(monto_pagado) AS total_pagado
        FROM PAGO
        GROUP BY id_cuota
      ) pagos ON pagos.id_cuota = cu.id_cuota
      WHERE cu.monto - COALESCE(pagos.total_pagado, 0) > 0
        AND (
          cu.fecha_limite < ?
          OR cu.fecha_limite BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
        )
      ORDER BY cu.fecha_limite ASC
    `,
    [currentDate, currentDate, currentDate, currentDate, config.dias_antes],
  );

  let enviados = 0;

  for (const quota of pendingQuotas) {
    const diasParaVencer = Number(quota.dias_para_vencer || 0);
    const tipo = diasParaVencer < 0 ? "VENCIDO" : "PROXIMO_VENCIMIENTO";
    const { titulo, mensaje } = buildReminderTemplate({
      tipo,
      servicio: quota.servicio,
      monto: quota.saldo,
      fecha_limite: quota.fecha_limite,
      dias_para_vencer: diasParaVencer,
    });

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existing] = await connection.execute(
        `
          SELECT id_recordatorio
          FROM RECORDATORIO_PAGO
          WHERE id_cuota = ? AND tipo = ? AND fecha_envio = ?
          LIMIT 1
        `,
        [quota.id_cuota, tipo, currentDate],
      );

      if (existing.length > 0) {
        await connection.rollback();
        continue;
      }

      const [notificationResult] = await connection.execute(
        `
          INSERT INTO NOTIFICACION (id_usuario, id_acceso, tipo, titulo, mensaje, leido)
          VALUES (?, NULL, ?, ?, ?, FALSE)
        `,
        [quota.id_usuario, NOTIFICATION_TYPE, titulo, mensaje],
      );

      await connection.execute(
        `
          INSERT INTO RECORDATORIO_PAGO (
            id_casa,
            id_cuota,
            id_usuario,
            id_notificacion,
            tipo,
            titulo,
            mensaje,
            monto,
            fecha_limite,
            dias_para_vencer,
            fecha_envio
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          quota.id_casa,
          quota.id_cuota,
          quota.id_usuario,
          notificationResult.insertId,
          tipo,
          titulo,
          mensaje,
          Number(quota.saldo || 0),
          quota.fecha_limite,
          diasParaVencer,
          currentDate,
        ],
      );

      await connection.commit();
      enviados += 1;
    } catch (error) {
      await connection.rollback();

      // La restriccion unica evita duplicados si dos procesos corren a la vez.
      if (error && error.code === "ER_DUP_ENTRY") {
        continue;
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  return { enviados, fecha_revision: currentDate, activo: true };
}

async function getReminderSummary() {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN tipo = 'PROXIMO_VENCIMIENTO' THEN 1 ELSE 0 END) AS proximos,
      SUM(CASE WHEN tipo = 'VENCIDO' THEN 1 ELSE 0 END) AS vencidos,
      SUM(CASE WHEN fecha_envio = CURDATE() THEN 1 ELSE 0 END) AS enviados_hoy
    FROM RECORDATORIO_PAGO
  `);

  const summary = rows[0] || {};

  return {
    total: Number(summary.total || 0),
    proximos: Number(summary.proximos || 0),
    vencidos: Number(summary.vencidos || 0),
    enviados_hoy: Number(summary.enviados_hoy || 0),
  };
}

async function listReminders(filters = {}) {
  const search = normalizeString(filters.search).toLowerCase();
  const type = normalizeReminderType(filters.type);
  const sqlFilters = [];
  const params = [];

  if (search) {
    const like = `%${search}%`;
    sqlFilters.push(`
      (
        LOWER(u.nombre) LIKE ?
        OR LOWER(
          CONCAT(
            COALESCE(c.torre, ''),
            CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
            c.numero
          )
        ) LIKE ?
      )
    `);
    params.push(like, like);
  }

  if (type) {
    sqlFilters.push("rp.tipo = ?");
    params.push(type);
  }

  const whereClause = sqlFilters.length ? `WHERE ${sqlFilters.join(" AND ")}` : "";
  const rows = await query(
    `
      SELECT
        rp.id_recordatorio,
        rp.tipo,
        rp.titulo,
        rp.mensaje,
        rp.monto,
        DATE_FORMAT(rp.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        rp.dias_para_vencer,
        DATE_FORMAT(rp.enviado_en, '%Y-%m-%d %H:%i') AS enviado_en,
        c.numero,
        c.torre,
        u.nombre AS residente,
        u.correo,
        srv.nombre AS servicio
      FROM RECORDATORIO_PAGO rp
      INNER JOIN CASA c ON c.id_casa = rp.id_casa
      INNER JOIN USUARIO u ON u.id_usuario = rp.id_usuario
      LEFT JOIN CUOTA cu ON cu.id_cuota = rp.id_cuota
      LEFT JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      ${whereClause}
      ORDER BY rp.enviado_en DESC, rp.id_recordatorio DESC
      LIMIT 100
    `,
    params,
  );

  return rows.map(mapReminder);
}

module.exports = {
  getReminderConfig,
  saveReminderConfig,
  sendPaymentReminders,
  getReminderSummary,
  listReminders,
  __private__: {
    buildHouseLabel,
    buildReminderTemplate,
    mapReminder,
    normalizeReminderType,
    normalizeDaysBefore,
    formatCurrency,
  },
};
