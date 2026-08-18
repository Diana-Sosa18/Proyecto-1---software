const { query } = require("../database/mysql");

const RESIDENTIAL_TIMEZONE = "America/Guatemala";
const ACCOUNT_STATUSES = {
  PAID: "PAGADA",
  PENDING: "PENDIENTE",
  OVERDUE: "VENCIDA",
};

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

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeDate(value) {
  const date = normalizeString(value);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("La fecha debe tener formato YYYY-MM-DD.");
    error.status = 400;
    throw error;
  }
  return date;
}

function buildHouseLabel(row) {
  const tower = normalizeString(row.torre);
  const number = normalizeString(row.numero);

  return tower ? `${tower}-${number}` : number;
}

function toMoney(value) {
  return Math.round(Number(value || 0) * 100 + 1e-9) / 100;
}

function isRentQuota(row) {
  const haystack = [row.servicio, row.tipo_servicio]
    .map((value) => normalizeString(value).toLowerCase())
    .join(" ");

  return ["alquiler", "renta", "arrendamiento"].some((keyword) => haystack.includes(keyword));
}

function getQuotaStatus(row, currentDate = getCurrentDateInTimezone()) {
  const amount = Number(row.monto || 0) + Number(row.recargo || 0);
  const paid = Number(row.total_pagado || 0);

  if (paid >= amount) {
    return ACCOUNT_STATUSES.PAID;
  }

  return String(row.fecha_limite || "") < currentDate
    ? ACCOUNT_STATUSES.OVERDUE
    : ACCOUNT_STATUSES.PENDING;
}

function mapQuota(row, currentDate = getCurrentDateInTimezone()) {
  const baseAmount = toMoney(row.monto);
  const surcharge = toMoney(row.recargo);
  const amount = toMoney(baseAmount + surcharge);
  const paid = toMoney(row.total_pagado);
  const balance = toMoney(Math.max(amount - paid, 0));

  return {
    id_cuota: row.id_cuota,
    id_casa: row.id_casa,
    casa_unidad: buildHouseLabel(row),
    servicio: row.servicio,
    tipo_servicio: row.tipo_servicio || "General",
    monto: amount,
    monto_base: baseAmount,
    recargo: surcharge,
    monto_pagado: paid,
    saldo_pendiente: balance,
    fecha_limite: row.fecha_limite,
    ultimo_pago: row.ultimo_pago || null,
    estado: getQuotaStatus(row, currentDate),
    es_alquiler: isRentQuota(row),
  };
}

function buildSummary(quotas, currentDate = getCurrentDateInTimezone()) {
  const pendingQuotas = quotas.filter((quota) => quota.estado !== ACCOUNT_STATUSES.PAID);
  const rentQuotas = quotas.filter((quota) => quota.es_alquiler);
  const additionalQuotas = quotas.filter((quota) => !quota.es_alquiler);
  const upcomingDueDates = pendingQuotas
    .filter((quota) => quota.fecha_limite >= currentDate)
    .map((quota) => quota.fecha_limite)
    .sort();

  return {
    total_cuotas: quotas.length,
    cuotas_pagadas: quotas.filter((quota) => quota.estado === ACCOUNT_STATUSES.PAID).length,
    cuotas_pendientes: quotas.filter((quota) => quota.estado === ACCOUNT_STATUSES.PENDING).length,
    cuotas_vencidas: quotas.filter((quota) => quota.estado === ACCOUNT_STATUSES.OVERDUE).length,
    saldo_pendiente: toMoney(
      pendingQuotas.reduce((total, quota) => total + quota.saldo_pendiente, 0),
    ),
    alquiler_pendiente: toMoney(
      rentQuotas.reduce((total, quota) => total + quota.saldo_pendiente, 0),
    ),
    cuotas_adicionales_pendientes: toMoney(
      additionalQuotas.reduce((total, quota) => total + quota.saldo_pendiente, 0),
    ),
    total_pagado: toMoney(quotas.reduce((total, quota) => total + quota.monto_pagado, 0)),
    proximo_vencimiento: upcomingDueDates[0] || null,
    actualizado_en: new Date().toISOString(),
  };
}

async function getTenantHouse(userId) {
  const rows = await query(
    `
      SELECT
        c.id_casa,
        c.numero,
        c.torre,
        propietario.nombre AS propietario_nombre
      FROM INQUILINO i
      INNER JOIN INQUILINO_CASA ic
        ON ic.id_inquilino = i.id_inquilino
      INNER JOIN CASA c
        ON c.id_casa = ic.id_casa
      INNER JOIN RESIDENTE r
        ON r.id_residente = c.id_residente
      INNER JOIN USUARIO propietario
        ON propietario.id_usuario = r.id_usuario
      WHERE i.id_usuario = ?
        AND i.autorizado = TRUE
      LIMIT 1
    `,
    [userId],
  );

  if (!rows[0]) {
    const error = new Error("No se encontro una casa autorizada para este inquilino.");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function listTenantAccountStatement(userId, filters = {}) {
  const house = await getTenantHouse(userId);
  const desde = normalizeDate(filters.desde);
  const hasta = normalizeDate(filters.hasta);
  if (desde && hasta && desde > hasta) {
    const error = new Error("El rango de fechas es invalido."); error.status = 400; throw error;
  }
  const currentDate = getCurrentDateInTimezone();
  const rows = await query(
    `
      SELECT
        cu.id_cuota,
        cu.id_casa,
        cu.monto,
        DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        c.numero,
        c.torre,
        srv.nombre AS servicio,
        srv.tipo_servicio,
        COALESCE(MAX(rec.monto_recargo), 0) AS recargo,
        COALESCE(SUM(p.monto_pagado), 0) AS total_pagado,
        DATE_FORMAT(MAX(p.fecha_pago), '%Y-%m-%d') AS ultimo_pago
      FROM CUOTA cu
      INNER JOIN CASA c
        ON c.id_casa = cu.id_casa
      INNER JOIN SERVICIO srv
        ON srv.id_servicio = cu.id_servicio
      LEFT JOIN PAGO p
        ON p.id_cuota = cu.id_cuota
      LEFT JOIN RECARGO_APLICADO rec
        ON rec.id_cuota = cu.id_cuota
      WHERE cu.id_casa = ? ${desde ? "AND cu.fecha_limite >= ?" : ""} ${hasta ? "AND cu.fecha_limite <= ?" : ""}
      GROUP BY
        cu.id_cuota,
        cu.id_casa,
        cu.monto,
        cu.fecha_limite,
        c.numero,
        c.torre,
        srv.nombre,
        srv.tipo_servicio
      ORDER BY
        CASE
          WHEN LOWER(CONCAT(srv.nombre, ' ', COALESCE(srv.tipo_servicio, ''))) LIKE '%alquiler%' THEN 0
          WHEN LOWER(CONCAT(srv.nombre, ' ', COALESCE(srv.tipo_servicio, ''))) LIKE '%renta%' THEN 0
          ELSE 1
        END,
        cu.fecha_limite ASC,
        cu.id_cuota ASC
    `,
    [house.id_casa, ...(desde ? [desde] : []), ...(hasta ? [hasta] : [])],
  );

  const cuotas = rows.map((row) => mapQuota(row, currentDate));
  const alquiler = cuotas.filter((quota) => quota.es_alquiler);
  const cuotasAdicionales = cuotas.filter((quota) => !quota.es_alquiler);
  const paymentRows = await query(
    `SELECT pg.id_pago, pg.id_cuota, pg.monto_pagado,
            DATE_FORMAT(pg.fecha_pago, '%Y-%m-%d') AS fecha_pago, srv.nombre AS servicio
       FROM PAGO pg INNER JOIN CUOTA cu ON cu.id_cuota = pg.id_cuota
       INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      WHERE cu.id_casa = ? ${desde ? "AND pg.fecha_pago >= ?" : ""} ${hasta ? "AND pg.fecha_pago <= ?" : ""}
      ORDER BY pg.fecha_pago DESC, pg.id_pago DESC`,
    [house.id_casa, ...(desde ? [desde] : []), ...(hasta ? [hasta] : [])],
  );
  const surchargeRows = await query(
    `SELECT ra.id_recargo, ra.id_cuota, srv.nombre AS servicio, ra.monto_recargo,
            DATE_FORMAT(ra.fecha_aplicacion, '%Y-%m-%d') AS fecha_aplicacion
       FROM RECARGO_APLICADO ra INNER JOIN CUOTA cu ON cu.id_cuota = ra.id_cuota
       INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      WHERE ra.id_casa = ? ${desde ? "AND ra.fecha_aplicacion >= ?" : ""} ${hasta ? "AND ra.fecha_aplicacion <= ?" : ""}
      ORDER BY ra.fecha_aplicacion DESC`,
    [house.id_casa, ...(desde ? [desde] : []), ...(hasta ? [hasta] : [])],
  );

  return {
    casa: {
      id_casa: Number(house.id_casa),
      unidad: buildHouseLabel(house),
      propietario: house.propietario_nombre,
    },
    resumen: buildSummary(cuotas, currentDate),
    alquiler,
    cuotas_adicionales: cuotasAdicionales,
    pagos: paymentRows.map((row) => ({
      id_pago: Number(row.id_pago), id_cuota: Number(row.id_cuota), servicio: row.servicio,
      monto_pagado: toMoney(row.monto_pagado), fecha_pago: row.fecha_pago,
      numero_comprobante: paymentReference(row.id_pago),
    })),
    recargos: surchargeRows.map((row) => ({ ...row, id_recargo: Number(row.id_recargo), id_cuota: Number(row.id_cuota), monto_recargo: toMoney(row.monto_recargo) })),
    periodo: { desde: desde || null, hasta: hasta || null },
  };
}

function paymentReference(id) {
  return `NXR-${String(id).padStart(8, "0")}`;
}

module.exports = {
  listTenantAccountStatement,
  __private__: {
    ACCOUNT_STATUSES,
    buildHouseLabel,
    buildSummary,
    getQuotaStatus,
    isRentQuota,
    mapQuota,
    toMoney,
    normalizeDate,
  },
};
