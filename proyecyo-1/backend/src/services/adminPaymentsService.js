const { query } = require("../database/mysql");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeDate(value) {
  const normalized = normalizeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizePaymentStatus(value) {
  const normalized = normalizeString(value).toUpperCase();

  if (!normalized || normalized === "TODOS") {
    return null;
  }

  if (!["MOROSO", "PENDIENTE", "PAGADO"].includes(normalized)) {
    const error = new Error("El filtro de estado de pago es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function mapAdminPayment(row) {
  return {
    id_casa: Number(row.id_casa),
    unidad: row.unidad,
    propietario_nombre: row.propietario_nombre,
    propietario_correo: row.propietario_correo,
    monto_pendiente: Number(row.monto_pendiente),
    fecha_limite: row.fecha_limite || null,
    estado: row.estado,
  };
}

async function listDelinquentResidents(filters = {}) {
  const search = normalizeString(filters.search).toLowerCase();
  const estado = normalizePaymentStatus(filters.estado);
  const date = normalizeDate(filters.date);
  const sqlFilters = ["1 = 1"];
  const params = [];

  if (search) {
    sqlFilters.push("(LOWER(resumen.propietario_nombre) LIKE ? OR LOWER(resumen.unidad) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (estado) {
    sqlFilters.push("resumen.estado = ?");
    params.push(estado);
  }

  if (date) {
    sqlFilters.push("resumen.fecha_limite = ?");
    params.push(date);
  }

  const rows = await query(
    `
      SELECT * FROM (
        SELECT
          c.id_casa,
          CASE
            WHEN c.torre IS NOT NULL AND c.torre <> '' THEN CONCAT(c.torre, '-', c.numero)
            ELSE c.numero
          END AS unidad,
          propietario.nombre AS propietario_nombre,
          propietario.correo AS propietario_correo,
          COALESCE(saldo.monto_pendiente, 0) AS monto_pendiente,
          DATE_FORMAT(saldo.proxima_fecha_limite, '%Y-%m-%d') AS fecha_limite,
          CASE
            WHEN COALESCE(saldo.monto_pendiente, 0) <= 0 THEN 'PAGADO'
            WHEN COALESCE(saldo.tiene_mora, 0) = 1 THEN 'MOROSO'
            ELSE 'PENDIENTE'
          END AS estado
        FROM CASA c
        INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente
        INNER JOIN USUARIO propietario ON propietario.id_usuario = r.id_usuario
        LEFT JOIN (
          SELECT
            cu.id_casa,
            SUM(GREATEST(cu.monto - COALESCE(pg.total_pagado, 0), 0)) AS monto_pendiente,
            MIN(CASE WHEN cu.monto - COALESCE(pg.total_pagado, 0) > 0 THEN cu.fecha_limite END) AS proxima_fecha_limite,
            MAX(
              CASE
                WHEN cu.monto - COALESCE(pg.total_pagado, 0) > 0 AND cu.fecha_limite < CURDATE() THEN 1
                ELSE 0
              END
            ) AS tiene_mora
          FROM CUOTA cu
          LEFT JOIN (
            SELECT id_cuota, SUM(monto_pagado) AS total_pagado
            FROM PAGO
            GROUP BY id_cuota
          ) pg ON pg.id_cuota = cu.id_cuota
          GROUP BY cu.id_casa
        ) saldo ON saldo.id_casa = c.id_casa
      ) resumen
      WHERE ${sqlFilters.join(" AND ")}
      ORDER BY (resumen.estado = 'MOROSO') DESC, resumen.monto_pendiente DESC, resumen.propietario_nombre ASC
    `,
    params,
  );

  return rows.map(mapAdminPayment);
}

module.exports = {
  listDelinquentResidents,
};
