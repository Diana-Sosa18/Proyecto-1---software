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

function buildHouseLabel(row) {
  const tower = String(row.torre || "").trim();
  const number = String(row.numero || "").trim();

  return tower ? `${tower}-${number}` : number;
}

function toMoney(value) {
  return Math.round(Number(value || 0) * 100 + 1e-9) / 100;
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
  const status = getQuotaStatus(row, currentDate);

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
    estado: status,
  };
}

function buildSummary(quotas, currentDate = getCurrentDateInTimezone()) {
  const pendingQuotas = quotas.filter((quota) => quota.estado !== ACCOUNT_STATUSES.PAID);
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
    total_pagado: toMoney(quotas.reduce((total, quota) => total + quota.monto_pagado, 0)),
    proximo_vencimiento: upcomingDueDates[0] || null,
    actualizado_en: new Date().toISOString(),
  };
}

async function listResidentAccountStatement(userId) {
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
      INNER JOIN RESIDENTE r
        ON r.id_residente = c.id_residente
      INNER JOIN SERVICIO srv
        ON srv.id_servicio = cu.id_servicio
      LEFT JOIN PAGO p
        ON p.id_cuota = cu.id_cuota
      LEFT JOIN RECARGO_APLICADO rec
        ON rec.id_cuota = cu.id_cuota
      WHERE r.id_usuario = ?
        AND LOWER(COALESCE(srv.tipo_servicio, '')) <> 'alquiler'
        AND LOWER(srv.nombre) NOT LIKE '%alquiler%'
        AND LOWER(srv.nombre) NOT LIKE '%renta%'
      GROUP BY
        cu.id_cuota,
        cu.id_casa,
        cu.monto,
        cu.fecha_limite,
        c.numero,
        c.torre,
        srv.nombre,
        srv.tipo_servicio
      ORDER BY cu.fecha_limite ASC, cu.id_cuota ASC
    `,
    [userId],
  );

  const quotas = rows.map((row) => mapQuota(row, currentDate));

  return {
    resumen: buildSummary(quotas, currentDate),
    cuotas: quotas,
  };
}

module.exports = {
  listResidentAccountStatement,
  __private__: {
    ACCOUNT_STATUSES,
    buildHouseLabel,
    buildSummary,
    getQuotaStatus,
    mapQuota,
    toMoney,
  },
};
