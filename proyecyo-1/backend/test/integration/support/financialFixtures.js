// SQL race fixtures only. No production confirmation handler, API client or webhook processing.
const { connect } = require("./isolatedMysql");
const { calculateBalance, assertCollectible, toCents } = require("../../../src/services/financialBalance");
async function lockedBalance(connection, quotaId) {
  const [quotas] = await connection.execute("SELECT monto FROM CUOTA WHERE id_cuota = ? FOR UPDATE", [quotaId]);
  const [totals] = await connection.execute(`SELECT
    COALESCE((SELECT SUM(monto_recargo) FROM RECARGO_APLICADO WHERE id_cuota = ?),0) recargo,
    COALESCE((SELECT SUM(monto_pagado) FROM PAGO WHERE id_cuota = ?),0) pagado`, [quotaId, quotaId]);
  return calculateBalance({ ...quotas[0], ...totals[0] });
}
async function applyPartialFixture(quotaId, amount) {
  const connection = await connect();
  try {
    await connection.beginTransaction();
    const balance = await lockedBalance(connection, quotaId);
    assertCollectible(balance);
    if (toCents(amount) > toCents(balance.saldo)) throw Object.assign(new Error("Sobrepago TEST rechazado."), { status: 409 });
    const [payment] = await connection.execute("INSERT INTO PAGO (id_cuota,monto_pagado,fecha_pago) VALUES (?,?,CURDATE())", [quotaId, amount]);
    await connection.execute("INSERT INTO PAGO_ORIGEN(id_pago,id_cuota,origen,ambiente) VALUES (?,?,'HISTORICO','historical')", [payment.insertId, quotaId]);
    await connection.commit();
    return payment.insertId;
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.end(); }
}
async function confirmFixture(transactionId, failAfterPayment = false) {
  const connection = await connect();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM TRANSACCION_RECURRENTE WHERE id_transaccion=? FOR UPDATE", [transactionId]);
    const transaction = rows[0];
    if (transaction.id_pago) { await connection.commit(); return { paymentId: transaction.id_pago, applied: false }; }
    const balance = await lockedBalance(connection, transaction.id_cuota);
    assertCollectible(balance);
    const amount = Number(transaction.monto_centavos) / 100;
    if (toCents(amount) > toCents(balance.saldo)) throw new Error("Importe TEST excede saldo.");
    const [payment] = await connection.execute("INSERT INTO PAGO(id_cuota,monto_pagado,fecha_pago) VALUES(?,?,CURDATE())", [transaction.id_cuota, amount]);
    if (failAfterPayment) throw new Error("TEST failure after PAGO");
    await connection.execute("INSERT INTO PAGO_ORIGEN(id_pago,id_cuota,origen,ambiente) VALUES(?,?,'RECURRENTE',?)", [payment.insertId, transaction.id_cuota, transaction.ambiente]);
    await connection.execute("UPDATE TRANSACCION_RECURRENTE SET id_pago=?,estado='CONFIRMADA',confirmado_en=NOW(6) WHERE id_transaccion=?", [payment.insertId, transactionId]);
    await connection.commit();
    return { paymentId: payment.insertId, applied: true };
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.end(); }
}
module.exports = { lockedBalance, applyPartialFixture, confirmFixture };
