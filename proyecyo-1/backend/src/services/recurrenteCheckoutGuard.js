const { CheckoutError } = require("./recurrenteCheckoutErrors");
const ACTIVE_CHECKOUT_STATES = "'CREADO', 'PENDIENTE', 'INCIERTO'";
// Older terminal enum values alone cannot prove an external checkout is closed.
// Only authenticated expiration evidence can release a persisted external one.
const BLOCKING_CHECKOUT_CONDITION = `(estado IN (${ACTIVE_CHECKOUT_STATES}) OR
  (id_externo IS NOT NULL AND estado IN ('FALLIDO','CANCELADO','EXPIRADO') AND
    (estado <> 'EXPIRADO' OR COALESCE(estado_proveedor,'') <> 'expired' OR verificado_en IS NULL)))`;
async function assertNoRecurrenteOperation(connection, quotaId) {
  const [rows] = await connection.execute(
    `SELECT id_checkout FROM CHECKOUT_RECURRENTE
     WHERE id_cuota = ? AND ${BLOCKING_CHECKOUT_CONDITION} LIMIT 1`, [quotaId]);
  if (rows.length) throw new CheckoutError("CHECKOUT_SIMULATION_BLOCKED");
}
module.exports = { ACTIVE_CHECKOUT_STATES, BLOCKING_CHECKOUT_CONDITION, assertNoRecurrenteOperation };
