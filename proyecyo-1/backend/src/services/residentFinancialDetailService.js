const { query } = require("../database/mysql");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeDate(value) {
  const normalized = normalizeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function computeChargeStatus(monto, pagado) {
  const saldo = Number(monto || 0) - Number(pagado || 0);

  if (saldo <= 0) {
    return "PAGADO";
  }

  if (Number(pagado || 0) > 0) {
    return "PARCIAL";
  }

  return "PENDIENTE";
}

function mapCharge(row) {
  const monto = Number(row.monto || 0);
  const pagado = Number(row.pagado || 0);
  const recargo = Number(row.recargo || 0);

  return {
    id_cuota: Number(row.id_cuota),
    servicio: row.servicio,
    monto,
    pagado,
    recargo,
    saldo: Math.max(monto + recargo - pagado, 0),
    fecha_limite: row.fecha_limite,
    estado: computeChargeStatus(monto + recargo, pagado),
  };
}

function mapSurcharge(row) {
  return {
    id_recargo: Number(row.id_recargo),
    id_cuota: Number(row.id_cuota),
    servicio: row.servicio,
    tipo_regla: row.tipo_regla,
    monto_original: Number(row.monto_original || 0),
    monto_recargo: Number(row.monto_recargo || 0),
    fecha_aplicacion: row.fecha_aplicacion,
  };
}

function mapPayment(row) {
  return {
    id_pago: Number(row.id_pago),
    id_cuota: Number(row.id_cuota),
    servicio: row.servicio,
    monto_pagado: Number(row.monto_pagado || 0),
    fecha_pago: row.fecha_pago,
  };
}

async function getResidentHouse(userId) {
  const rows = await query(
    `
      SELECT c.id_casa,
             c.numero,
             c.torre
      FROM CASA c
      INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente
      WHERE r.id_usuario = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!rows[0]) {
    const error = new Error("No se encontro una unidad asociada a este residente.");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function getFinancialDetail(userId, filters = {}) {
  const desde = normalizeDate(filters.desde);
  const hasta = normalizeDate(filters.hasta);
  const house = await getResidentHouse(userId);

  const chargeFilters = ["cu.id_casa = ?"];
  const chargeParams = [house.id_casa];
  if (desde) {
    chargeFilters.push("cu.fecha_limite >= ?");
    chargeParams.push(desde);
  }
  if (hasta) {
    chargeFilters.push("cu.fecha_limite <= ?");
    chargeParams.push(hasta);
  }

  const charges = await query(
    `
      SELECT
        cu.id_cuota,
        srv.nombre AS servicio,
        cu.monto,
        DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') AS fecha_limite,
        COALESCE(pagos.total_pagado, 0) AS pagado,
        COALESCE(rec.monto_recargo, 0) AS recargo
      FROM CUOTA cu
      INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      LEFT JOIN (
        SELECT id_cuota, SUM(monto_pagado) AS total_pagado
        FROM PAGO
        GROUP BY id_cuota
      ) pagos ON pagos.id_cuota = cu.id_cuota
      LEFT JOIN RECARGO_APLICADO rec ON rec.id_cuota = cu.id_cuota
      WHERE ${chargeFilters.join(" AND ")}
      ORDER BY cu.fecha_limite DESC, cu.id_cuota DESC
    `,
    chargeParams,
  );

  const surchargeFilters = ["rec.id_casa = ?"];
  const surchargeParams = [house.id_casa];
  if (desde) {
    surchargeFilters.push("rec.fecha_aplicacion >= ?");
    surchargeParams.push(desde);
  }
  if (hasta) {
    surchargeFilters.push("rec.fecha_aplicacion <= ?");
    surchargeParams.push(hasta);
  }

  const surcharges = await query(
    `
      SELECT
        rec.id_recargo,
        rec.id_cuota,
        srv.nombre AS servicio,
        rec.tipo_regla,
        rec.monto_original,
        rec.monto_recargo,
        DATE_FORMAT(rec.fecha_aplicacion, '%Y-%m-%d') AS fecha_aplicacion
      FROM RECARGO_APLICADO rec
      INNER JOIN CUOTA cu ON cu.id_cuota = rec.id_cuota
      INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      WHERE ${surchargeFilters.join(" AND ")}
      ORDER BY rec.fecha_aplicacion DESC, rec.id_recargo DESC
    `,
    surchargeParams,
  );

  const paymentFilters = ["cu.id_casa = ?"];
  const paymentParams = [house.id_casa];
  if (desde) {
    paymentFilters.push("pg.fecha_pago >= ?");
    paymentParams.push(desde);
  }
  if (hasta) {
    paymentFilters.push("pg.fecha_pago <= ?");
    paymentParams.push(hasta);
  }

  const payments = await query(
    `
      SELECT
        pg.id_pago,
        pg.id_cuota,
        srv.nombre AS servicio,
        pg.monto_pagado,
        DATE_FORMAT(pg.fecha_pago, '%Y-%m-%d') AS fecha_pago
      FROM PAGO pg
      INNER JOIN CUOTA cu ON cu.id_cuota = pg.id_cuota
      INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
      WHERE ${paymentFilters.join(" AND ")}
      ORDER BY pg.fecha_pago DESC, pg.id_pago DESC
    `,
    paymentParams,
  );

  const cargos = charges.map(mapCharge);
  const recargos = surcharges.map(mapSurcharge);
  const pagos = payments.map(mapPayment);

  const totalCargos = cargos.reduce((sum, item) => sum + item.monto, 0);
  const totalRecargos = recargos.reduce((sum, item) => sum + item.monto_recargo, 0);
  const totalPagado = pagos.reduce((sum, item) => sum + item.monto_pagado, 0);

  return {
    unidad: house.torre ? `${house.torre}-${house.numero}` : house.numero,
    periodo: {
      desde: desde || null,
      hasta: hasta || null,
    },
    resumen: {
      total_cargos: Number(totalCargos.toFixed(2)),
      total_recargos: Number(totalRecargos.toFixed(2)),
      total_pagado: Number(totalPagado.toFixed(2)),
      saldo_pendiente: Number(Math.max(totalCargos + totalRecargos - totalPagado, 0).toFixed(2)),
    },
    cargos,
    recargos,
    pagos,
  };
}

module.exports = {
  getFinancialDetail,
  __private__: {
    normalizeDate,
    computeChargeStatus,
    mapCharge,
    mapSurcharge,
    mapPayment,
  },
};
