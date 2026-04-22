const { query } = require("../database/mysql");

const RESIDENTIAL_TIMEZONE = "America/Guatemala";

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

function normalizeAccessType(value) {
  const normalized = normalizeString(value).toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  const allowed = ["RESIDENTE", "VISITANTE", "PROVEEDOR"];

  if (!allowed.includes(normalized)) {
    const error = new Error("El filtro de tipo es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function normalizeAccessStatus(value) {
  const normalized = normalizeString(value).toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  const allowed = ["APROBADO", "PENDIENTE", "RECHAZADO"];

  if (!allowed.includes(normalized)) {
    const error = new Error("El filtro de estado es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function mapAccessType(tipoVisita) {
  const normalized = normalizeString(tipoVisita).toUpperCase();

  if (normalized === "PROVEEDOR") {
    return "PROVEEDOR";
  }

  if (normalized === "RESIDENTE") {
    return "RESIDENTE";
  }

  return "VISITANTE";
}

function mapAccessStatus(estadoAcceso) {
  const normalized = normalizeString(estadoAcceso).toUpperCase();

  if (["AUTORIZADA", "INGRESO_REGISTRADO", "APROBADA"].includes(normalized)) {
    return "APROBADO";
  }

  if (normalized === "PENDIENTE") {
    return "PENDIENTE";
  }

  if (["CANCELADA", "RECHAZADA"].includes(normalized)) {
    return "RECHAZADO";
  }

  return "PENDIENTE";
}

function buildHouseLabel(row) {
  const tower = normalizeString(row.torre);
  const number = normalizeString(row.numero);

  return tower ? `${tower}-${number}` : number;
}

function buildAuthorizerLabel(row) {
  return normalizeString(row.autorizado_por) || "Sin registro";
}

function mapAdminAccess(row) {
  return {
    id_acceso: row.id_acceso,
    fecha: row.fecha,
    hora: row.hora || "--:--",
    tipo: mapAccessType(row.tipo_visita),
    nombre: row.nombre,
    casa_unidad: buildHouseLabel(row),
    placa: normalizeString(row.placa) || "-",
    estado: mapAccessStatus(row.estado_acceso),
    autorizado_por: buildAuthorizerLabel(row),
  };
}

function appendSearchFilter(filters, params, search) {
  if (!search) {
    return;
  }

  const normalizedSearch = `%${search.toLowerCase()}%`;

  filters.push(`
    (
      LOWER(v.nombre) LIKE ?
      OR LOWER(COALESCE(v.placa, '')) LIKE ?
      OR LOWER(
        CONCAT(
          COALESCE(c.torre, ''),
          CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
          c.numero
        )
      ) LIKE ?
    )
  `);

  params.push(normalizedSearch, normalizedSearch, normalizedSearch);
}

function appendTypeFilter(filters, accessType) {
  if (!accessType) {
    return;
  }

  if (accessType === "PROVEEDOR") {
    filters.push("UPPER(COALESCE(a.tipo_visita, '')) = 'PROVEEDOR'");
    return;
  }

  if (accessType === "RESIDENTE") {
    filters.push("UPPER(COALESCE(a.tipo_visita, '')) = 'RESIDENTE'");
    return;
  }

  filters.push(`
    (
      a.tipo_visita IS NULL
      OR UPPER(a.tipo_visita) IN ('VISITA', 'DELIVERY', 'VISITANTE')
    )
  `);
}

function appendStatusFilter(filters, accessStatus) {
  if (!accessStatus) {
    return;
  }

  if (accessStatus === "APROBADO") {
    filters.push("UPPER(COALESCE(a.estado_acceso, '')) IN ('AUTORIZADA', 'INGRESO_REGISTRADO', 'APROBADA')");
    return;
  }

  if (accessStatus === "PENDIENTE") {
    filters.push("UPPER(COALESCE(a.estado_acceso, '')) = 'PENDIENTE'");
    return;
  }

  filters.push("UPPER(COALESCE(a.estado_acceso, '')) IN ('CANCELADA', 'RECHAZADA')");
}

async function getAdminAccessSummary() {
  const currentDate = getCurrentDateInTimezone();
  const rows = await query(
    `
      SELECT
        COUNT(*) AS total_dia,
        SUM(
          CASE
            WHEN UPPER(COALESCE(a.estado_acceso, '')) IN ('AUTORIZADA', 'INGRESO_REGISTRADO', 'APROBADA')
              THEN 1
            ELSE 0
          END
        ) AS aprobados,
        SUM(
          CASE
            WHEN UPPER(COALESCE(a.estado_acceso, '')) = 'PENDIENTE'
              THEN 1
            ELSE 0
          END
        ) AS pendientes,
        SUM(
          CASE
            WHEN UPPER(COALESCE(a.estado_acceso, '')) IN ('CANCELADA', 'RECHAZADA')
              THEN 1
            ELSE 0
          END
        ) AS rechazados
      FROM ACCESO a
      WHERE a.fecha = ?
    `,
    [currentDate],
  );

  const summary = rows[0] || {};

  return {
    total_dia: Number(summary.total_dia || 0),
    aprobados: Number(summary.aprobados || 0),
    pendientes: Number(summary.pendientes || 0),
    rechazados: Number(summary.rechazados || 0),
  };
}

async function listAdminAccesses(filters = {}) {
  const currentDate = getCurrentDateInTimezone();
  const search = normalizeString(filters.search).toLowerCase();
  const accessType = normalizeAccessType(filters.type);
  const accessStatus = normalizeAccessStatus(filters.status);
  const sqlFilters = ["a.fecha = ?"];
  const params = [currentDate];

  appendSearchFilter(sqlFilters, params, search);
  appendTypeFilter(sqlFilters, accessType);
  appendStatusFilter(sqlFilters, accessStatus);

  const rows = await query(
    `
      SELECT
        a.id_acceso,
        DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
        COALESCE(
          TIME_FORMAT(ra.hora_ingreso, '%H:%i'),
          TIME_FORMAT(a.hora_inicio, '%H:%i'),
          '--:--'
        ) AS hora,
        a.tipo_visita,
        a.estado_acceso,
        v.nombre,
        v.placa,
        c.numero,
        c.torre,
        propietario.nombre AS autorizado_por
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      INNER JOIN RESIDENTE r
        ON r.id_residente = c.id_residente
      INNER JOIN USUARIO propietario
        ON propietario.id_usuario = r.id_usuario
      LEFT JOIN REGISTRO_ACCESO ra
        ON ra.id_acceso = a.id_acceso
      WHERE ${sqlFilters.join(" AND ")}
      ORDER BY
        COALESCE(ra.hora_ingreso, a.hora_inicio, '00:00:00') DESC,
        a.id_acceso DESC
    `,
    params,
  );

  return rows.map(mapAdminAccess);
}

module.exports = {
  getAdminAccessSummary,
  listAdminAccesses,
};
