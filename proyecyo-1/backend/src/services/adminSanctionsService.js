const { query } = require("../database/mysql");

const RESIDENTIAL_TIMEZONE = "America/Guatemala";
const OVERDUE_FEE_RULE = {
  codigo: "CUOTA_VENCIDA",
  nombre: "Cuota vencida",
  descripcion: "Genera una sancion cuando una cuota supera su fecha limite sin pago completo.",
  monto_base: 50,
  porcentaje: 10,
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
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeSanctionStatus(value) {
  const normalized = normalizeString(value).toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  const allowed = ["PENDIENTE", "PAGADA", "ANULADA"];

  if (!allowed.includes(normalized)) {
    const error = new Error("El estado de sancion es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function buildHouseLabel(row) {
  const tower = normalizeString(row.torre);
  const number = normalizeString(row.numero);

  return tower ? `${tower}-${number}` : number;
}

function mapSanction(row) {
  return {
    id_sancion: row.id_sancion,
    casa_unidad: buildHouseLabel(row),
    residente: row.residente,
    codigo_regla: row.codigo_regla,
    motivo: row.motivo,
    detalle: row.detalle,
    monto: Number(row.monto || 0),
    estado: row.estado,
    generada_automaticamente: Boolean(row.generada_automaticamente),
    fecha_incumplimiento: row.fecha_incumplimiento,
    fecha_generacion: row.fecha_generacion,
    cuota_monto: row.cuota_monto === null ? null : Number(row.cuota_monto || 0),
    fecha_limite: row.fecha_limite,
    servicio: row.servicio,
  };
}

function appendSearchFilter(filters, params, search) {
  if (!search) {
    return;
  }

  const normalized = `%${search.toLowerCase()}%`;

  filters.push(`
    (
      LOWER(u.nombre) LIKE ?
      OR LOWER(s.motivo) LIKE ?
      OR LOWER(s.detalle) LIKE ?
      OR LOWER(
        CONCAT(
          COALESCE(c.torre, ''),
          CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
          c.numero
        )
      ) LIKE ?
    )
  `);
  params.push(normalized, normalized, normalized, normalized);
}

function appendHouseFilter(filters, params, house) {
  if (!house) {
    return;
  }

  const normalized = `%${house.toLowerCase()}%`;

  filters.push(`
    LOWER(
      CONCAT(
        COALESCE(c.torre, ''),
        CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
        c.numero
      )
    ) LIKE ?
  `);
  params.push(normalized);
}

async function getSanctionSummary() {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'PAGADA' THEN 1 ELSE 0 END) AS pagadas,
      SUM(CASE WHEN estado = 'ANULADA' THEN 1 ELSE 0 END) AS anuladas,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN monto ELSE 0 END) AS monto_pendiente
    FROM SANCION
  `);

  const summary = rows[0] || {};

  return {
    total: Number(summary.total || 0),
    pendientes: Number(summary.pendientes || 0),
    pagadas: Number(summary.pagadas || 0),
    anuladas: Number(summary.anuladas || 0),
    monto_pendiente: Number(summary.monto_pendiente || 0),
  };
}

async function listSanctionRules() {
  return [
    {
      codigo: OVERDUE_FEE_RULE.codigo,
      nombre: OVERDUE_FEE_RULE.nombre,
      descripcion: OVERDUE_FEE_RULE.descripcion,
      condicion: "fecha_limite < fecha actual y total pagado < monto de cuota",
      sancion: `Q${OVERDUE_FEE_RULE.monto_base} minimo o ${OVERDUE_FEE_RULE.porcentaje}% de la cuota vencida`,
      activa: true,
    },
  ];
}

async function applyAutomaticSanctions(userId) {
  const currentDate = getCurrentDateInTimezone();
  const result = await query(
    `
      INSERT IGNORE INTO SANCION (
        id_casa,
        id_cuota,
        codigo_regla,
        motivo,
        detalle,
        monto,
        estado,
        generada_automaticamente,
        fecha_incumplimiento,
        creado_por
      )
      SELECT
        cu.id_casa,
        cu.id_cuota,
        ?,
        ?,
        CONCAT(
          'La cuota de ', srv.nombre,
          ' por Q', FORMAT(cu.monto, 2),
          ' vencio el ', DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d'),
          ' y no registra pago completo.'
        ),
        GREATEST(?, ROUND(cu.monto * (? / 100), 2)),
        'PENDIENTE',
        TRUE,
        cu.fecha_limite,
        ?
      FROM CUOTA cu
      INNER JOIN SERVICIO srv
        ON srv.id_servicio = cu.id_servicio
      LEFT JOIN (
        SELECT id_cuota, SUM(monto_pagado) AS total_pagado
        FROM PAGO
        GROUP BY id_cuota
      ) pagos
        ON pagos.id_cuota = cu.id_cuota
      WHERE cu.fecha_limite < ?
        AND COALESCE(pagos.total_pagado, 0) < cu.monto
    `,
    [
      OVERDUE_FEE_RULE.codigo,
      OVERDUE_FEE_RULE.nombre,
      OVERDUE_FEE_RULE.monto_base,
      OVERDUE_FEE_RULE.porcentaje,
      userId,
      currentDate,
    ],
  );

  return {
    generadas: Number(result.affectedRows || 0),
    fecha_revision: currentDate,
  };
}

async function listSanctions(filters = {}) {
  const search = normalizeString(filters.search).toLowerCase();
  const house = normalizeString(filters.house).toLowerCase();
  const status = normalizeSanctionStatus(filters.status);
  const sqlFilters = [];
  const params = [];

  appendSearchFilter(sqlFilters, params, search);
  appendHouseFilter(sqlFilters, params, house);

  if (status) {
    sqlFilters.push("s.estado = ?");
    params.push(status);
  }

  const whereClause = sqlFilters.length ? `WHERE ${sqlFilters.join(" AND ")}` : "";
  const rows = await query(
    `
      SELECT
        s.id_sancion,
        s.codigo_regla,
        s.motivo,
        s.detalle,
        s.monto,
        s.estado,
        s.generada_automaticamente,
        DATE_FORMAT(s.fecha_incumplimiento, '%Y-%m-%d') AS fecha_incumplimiento,
        DATE_FORMAT(s.fecha_generacion, '%Y-%m-%d %H:%i') AS fecha_generacion,
        c.numero,
        c.torre,
        u.nombre AS residente,
        cu.monto AS cuota_monto,
        DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        srv.nombre AS servicio
      FROM SANCION s
      INNER JOIN CASA c
        ON c.id_casa = s.id_casa
      INNER JOIN RESIDENTE r
        ON r.id_residente = c.id_residente
      INNER JOIN USUARIO u
        ON u.id_usuario = r.id_usuario
      LEFT JOIN CUOTA cu
        ON cu.id_cuota = s.id_cuota
      LEFT JOIN SERVICIO srv
        ON srv.id_servicio = cu.id_servicio
      ${whereClause}
      ORDER BY s.fecha_generacion DESC, s.id_sancion DESC
    `,
    params,
  );

  return rows.map(mapSanction);
}

async function updateSanctionStatus(id, status) {
  const sanctionId = Number(id);
  const normalizedStatus = normalizeSanctionStatus(status);

  if (!Number.isInteger(sanctionId) || sanctionId <= 0) {
    const error = new Error("La sancion solicitada es invalida.");
    error.status = 400;
    throw error;
  }

  if (!normalizedStatus) {
    const error = new Error("Selecciona un estado valido para la sancion.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      UPDATE SANCION
      SET estado = ?
      WHERE id_sancion = ?
    `,
    [normalizedStatus, sanctionId],
  );

  if (Number(result.affectedRows || 0) === 0) {
    const error = new Error("No se encontro la sancion solicitada.");
    error.status = 404;
    throw error;
  }

  const rows = await listSanctions({});
  return rows.find((sanction) => sanction.id_sancion === sanctionId) || null;
}

module.exports = {
  getSanctionSummary,
  listSanctionRules,
  applyAutomaticSanctions,
  listSanctions,
  updateSanctionStatus,
};
