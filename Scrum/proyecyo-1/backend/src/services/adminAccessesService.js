const { query } = require("../database/mysql");

const ALLOWED_STATUSES = ["AUTORIZADA", "INGRESO_REGISTRADO", "CANCELADA"];

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  if (!ALLOWED_STATUSES.includes(normalized)) {
    const error = new Error("El estado seleccionado no es valido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function mapAdminAccess(row) {
  return {
    id_acceso: row.id_acceso,
    hora: row.hora || "--:--",
    nombre: row.nombre,
    casa: row.casa,
    placa: row.placa || "-",
    estado: row.estado_acceso,
    fecha: row.fecha,
    tipo_visita: row.tipo_visita,
  };
}

async function listAdminAccesses(filters = {}) {
  const statusFilter = normalizeStatus(filters.estado);

  const conditions = [];
  const params = [];

  if (statusFilter) {
    conditions.push("a.estado_acceso = ?");
    params.push(statusFilter);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query(
    `
      SELECT
        a.id_acceso,
        DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
        COALESCE(
          TIME_FORMAT(ra.hora_ingreso, '%H:%i'),
          TIME_FORMAT(a.hora_inicio, '%H:%i')
        ) AS hora,
        v.nombre,
        COALESCE(v.placa, '-') AS placa,
        CONCAT(
          COALESCE(c.torre, ''),
          CASE
            WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-'
            ELSE ''
          END,
          c.numero
        ) AS casa,
        a.estado_acceso,
        a.tipo_visita
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      LEFT JOIN REGISTRO_ACCESO ra
        ON ra.id_acceso = a.id_acceso
      ${whereClause}
      ORDER BY
        a.fecha DESC,
        COALESCE(ra.hora_ingreso, a.hora_inicio) DESC,
        a.id_acceso DESC
    `,
    params,
  );

  return rows.map(mapAdminAccess);
}

module.exports = {
  listAdminAccesses,
};