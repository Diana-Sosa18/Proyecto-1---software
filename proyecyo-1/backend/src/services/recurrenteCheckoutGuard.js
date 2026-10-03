const { CheckoutError } = require("./recurrenteCheckoutErrors");
const ACTIVE_CHECKOUT_STATES = "'CREADO', 'PENDIENTE', 'INCIERTO'";
const BLOCKING_CHECKOUT_CONDITION = `(estado IN (${ACTIVE_CHECKOUT_STATES}))`;
async function assertNoRecurrenteOperation(connection, quotaId) {
  const [rows] = await connection.execute(
    `SELECT id_checkout FROM CHECKOUT_RECURRENTE
     WHERE id_cuota = ? AND ${BLOCKING_CHECKOUT_CONDITION} LIMIT 1`, [quotaId]);
  if (rows.length) throw new CheckoutError("CHECKOUT_SIMULATION_BLOCKED");
}
module.exports = { ACTIVE_CHECKOUT_STATES, BLOCKING_CHECKOUT_CONDITION, assertNoRecurrenteOperation };
