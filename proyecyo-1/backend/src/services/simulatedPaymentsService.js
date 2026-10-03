const { pool } = require("../database/mysql");
const { calculateBalance, assertCollectible } = require("./financialBalance");
const { assertNoRecurrenteOperation } = require("./recurrenteCheckoutGuard");

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function payObligation(userId, role, quotaIdValue) {
  const quotaId = Number(quotaIdValue);
  if (!Number.isInteger(quotaId) || quotaId <= 0) throw httpError("La obligación es inválida.", 400);
  if (!['residente', 'inquilino'].includes(role)) throw httpError("Rol no autorizado.", 403);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ownershipJoin = role === "residente"
      ? "INNER JOIN RESIDENTE titular ON titular.id_residente = c.id_residente AND titular.id_usuario = ?"
      : `INNER JOIN INQUILINO_CASA ic ON ic.id_casa = c.id_casa
         INNER JOIN INQUILINO titular ON titular.id_inquilino = ic.id_inquilino AND titular.id_usuario = ? AND titular.autorizado = TRUE`;
    const [rows] = await connection.execute(
      `SELECT cu.id_cuota, cu.id_casa, cu.monto, DATE_FORMAT(cu.fecha_limite, '%Y-%m-%d') fecha_limite,
        srv.nombre concepto
       FROM CUOTA cu INNER JOIN CASA c ON c.id_casa = cu.id_casa
       INNER JOIN SERVICIO srv ON srv.id_servicio = cu.id_servicio
       ${ownershipJoin}
       WHERE cu.id_cuota = ? FOR UPDATE`,
      [userId, quotaId],
    );
    if (!rows.length) {
      const [exists] = await connection.execute("SELECT id_cuota FROM CUOTA WHERE id_cuota = ?", [quotaId]);
      throw httpError(exists.length ? "La obligación no pertenece a la unidad autorizada." : "La obligación no existe.", exists.length ? 403 : 404);
    }
    // Lock the quota BEFORE the first consistent read of payments. A waiter must see
    // the prior transaction's committed payment, not a stale aggregate from before the lock.
    const [totals] = await connection.execute(
      `SELECT COALESCE((SELECT SUM(monto_recargo) FROM RECARGO_APLICADO WHERE id_cuota = ?), 0) AS recargo,
              COALESCE((SELECT SUM(monto_pagado) FROM PAGO WHERE id_cuota = ?), 0) AS pagado`,
      [quotaId, quotaId],
    );
    const quota = { ...rows[0], ...totals[0] };
    const calculated = calculateBalance(quota);
    assertCollectible(calculated);
    const balance = calculated.saldo;
    if (balance <= 0) throw httpError("La obligación ya fue pagada.", 409);
    await assertNoRecurrenteOperation(connection, quotaId);
    const [payment] = await connection.execute(
      "INSERT INTO PAGO (id_cuota, monto_pagado, fecha_pago) VALUES (?, ?, CURDATE())",
      [quotaId, balance],
    );
    const [transaction] = await connection.execute(
      `INSERT INTO TRANSACCION_SIMULADA (id_pago, id_usuario, id_casa, rol, concepto, monto, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'APROBADA')`,
      [payment.insertId, userId, quota.id_casa, role, quota.concepto, balance],
    );
    await connection.execute(
      "INSERT INTO PAGO_ORIGEN (id_pago, id_cuota, origen, ambiente) VALUES (?, ?, 'SIMULADO', 'academic')",
      [payment.insertId, quotaId],
    );
    await connection.commit();
    return {
      id_transaccion: transaction.insertId, id_pago: payment.insertId, id_cuota: quotaId,
      concepto: quota.concepto, monto_base: Number(quota.monto), recargo: Number(quota.recargo),
      total: balance, estado: "APROBADA", fecha_limite: quota.fecha_limite,
      numero_comprobante: `NXR-${String(payment.insertId).padStart(8, "0")}`,
    };
  } catch (error) {
    await connection.rollback();
    if (error?.code === "ER_DUP_ENTRY") throw httpError("La obligación ya fue pagada.", 409);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { payObligation };
