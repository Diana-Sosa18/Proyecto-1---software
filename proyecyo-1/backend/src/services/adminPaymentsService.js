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
    recargo_aplicado: Number(row.recargo_aplicado || 0),
    total_pendiente: Number(row.monto_pendiente) + Number(row.recargo_aplicado || 0),
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
          COALESCE(recargos.total_recargo, 0) AS recargo_aplicado,
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
        LEFT JOIN (
          SELECT id_casa, SUM(monto_recargo) total_recargo FROM RECARGO_APLICADO GROUP BY id_casa
        ) recargos ON recargos.id_casa = c.id_casa
      ) resumen
      WHERE ${sqlFilters.join(" AND ")}
      ORDER BY (resumen.estado = 'MOROSO') DESC, resumen.monto_pendiente DESC, resumen.propietario_nombre ASC
    `,
    params,
  );

  return rows.map(mapAdminPayment);
}

function validateRecentChoice(value, allowed, label) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized || normalized === "TODOS") return null;
  if (!allowed.includes(normalized)) {
    const error = new Error(`El filtro de ${label} es inválido.`); error.status = 400; throw error;
  }
  return normalized;
}

async function listRecentPayments(filters = {}) {
  const search = normalizeString(filters.usuario).toLowerCase();
  const unit = normalizeString(filters.unidad).toLowerCase();
  const role = validateRecentChoice(filters.rol, ["RESIDENTE", "INQUILINO"], "rol");
  const status = validateRecentChoice(filters.estado, ["APROBADA", "RECHAZADA"], "estado");
  const from = filters.desde ? normalizeDate(filters.desde) : "";
  const to = filters.hasta ? normalizeDate(filters.hasta) : "";
  if ((filters.desde && !from) || (filters.hasta && !to) || (from && to && from > to)) {
    const error = new Error("El rango de fechas es inválido."); error.status = 400; throw error;
  }
  const where = ["1 = 1"]; const params = [];
  if (search) { where.push("LOWER(u.nombre) LIKE ?"); params.push(`%${search}%`); }
  if (unit) { where.push("LOWER(CONCAT(COALESCE(c.torre, ''), IF(COALESCE(c.torre, '') = '', '', '-'), c.numero)) LIKE ?"); params.push(`%${unit}%`); }
  if (role) { where.push("UPPER(t.rol) = ?"); params.push(role); }
  if (status) { where.push("UPPER(t.estado) = ?"); params.push(status); }
  if (from) { where.push("DATE(t.creado_en) >= ?"); params.push(from); }
  if (to) { where.push("DATE(t.creado_en) <= ?"); params.push(to); }
  const rows = await query(
    `SELECT t.id_transaccion, t.id_pago, t.id_usuario, u.nombre usuario, t.rol,
      CONCAT(COALESCE(c.torre, ''), IF(COALESCE(c.torre, '') = '', '', '-'), c.numero) unidad,
      t.concepto, t.monto, DATE_FORMAT(t.creado_en, '%Y-%m-%d') fecha,
      TIME_FORMAT(t.creado_en, '%H:%i:%s') hora, t.estado
     FROM TRANSACCION_SIMULADA t INNER JOIN USUARIO u ON u.id_usuario = t.id_usuario
     INNER JOIN CASA c ON c.id_casa = t.id_casa WHERE ${where.join(" AND ")}
     ORDER BY t.creado_en DESC, t.id_transaccion DESC LIMIT 100`, params,
  );
  return rows.map((row) => ({ ...row, id_transaccion: Number(row.id_transaccion), id_pago: Number(row.id_pago), id_usuario: Number(row.id_usuario), monto: Number(row.monto) }));
}

function normalizePeriod(monthValue, yearValue) {
  const month = Number(monthValue); const year = Number(yearValue);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    const error = new Error("El mes o anio del reporte es invalido."); error.status = 400; throw error;
  }
  return { month, year, from: `${year}-${String(month).padStart(2, "0")}-01` };
}

async function getMonthlyFinancialReport(monthValue, yearValue) {
  const period = normalizePeriod(monthValue, yearValue);
  const rows = await query(
    `SELECT c.id_casa, CONCAT(COALESCE(c.torre, ''), IF(c.torre IS NULL OR c.torre = '', '', '-'), c.numero) AS unidad,
            u.nombre AS usuario, s.nombre AS concepto, cu.monto,
            DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
            COALESCE(pg.pagado, 0) AS pagado, COALESCE(ra.recargo, 0) AS recargo
       FROM CUOTA cu INNER JOIN CASA c ON c.id_casa = cu.id_casa
       INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente INNER JOIN USUARIO u ON u.id_usuario = r.id_usuario
       INNER JOIN SERVICIO s ON s.id_servicio = cu.id_servicio
       LEFT JOIN (SELECT id_cuota, SUM(monto_pagado) pagado FROM PAGO WHERE fecha_pago >= ? AND fecha_pago < DATE_ADD(?, INTERVAL 1 MONTH) GROUP BY id_cuota) pg ON pg.id_cuota = cu.id_cuota
       LEFT JOIN (SELECT id_cuota, SUM(monto_recargo) recargo FROM RECARGO_APLICADO GROUP BY id_cuota) ra ON ra.id_cuota = cu.id_cuota
      WHERE cu.fecha_limite >= ? AND cu.fecha_limite < DATE_ADD(?, INTERVAL 1 MONTH)
      ORDER BY cu.fecha_limite, unidad`,
    [period.from, period.from, period.from, period.from],
  );
  const detalle = rows.map((row) => { const total = Number(row.monto) + Number(row.recargo); const pagado = Number(row.pagado); return {
    ...row, id_casa: Number(row.id_casa), monto: Number(row.monto), recargo: Number(row.recargo), pagado,
    pendiente: Math.max(total - pagado, 0), estado: pagado >= total ? "PAGADO" : row.fecha_limite < new Date().toISOString().slice(0, 10) ? "MOROSO" : "PENDIENTE",
  }; });
  return { periodo: { mes: period.month, anio: period.year }, resumen: {
    total_cobrado: detalle.reduce((s, i) => s + i.pagado, 0), total_pendiente: detalle.reduce((s, i) => s + i.pendiente, 0),
    total_mora: detalle.filter((i) => i.estado === "MOROSO").reduce((s, i) => s + i.pendiente, 0),
    cantidad_pagos: detalle.filter((i) => i.pagado > 0).length,
    usuarios_morosos: new Set(detalle.filter((i) => i.estado === "MOROSO").map((i) => i.id_casa)).size,
  }, detalle };
}

module.exports = {
  listDelinquentResidents,
  getMonthlyFinancialReport,
  listRecentPayments,
  __private__: { normalizePeriod },
};
