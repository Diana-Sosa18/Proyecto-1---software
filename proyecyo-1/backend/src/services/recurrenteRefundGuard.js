const { CheckoutError } = require('./recurrenteCheckoutErrors');
// Quota-level protection includes evidence of a refund initiated outside Nexus.
function refundBlockingSql(quotaExpression) {
  return `(EXISTS(SELECT 1 FROM REEMBOLSO_RECURRENTE rr JOIN TRANSACCION_RECURRENTE tr
    ON tr.id_transaccion=rr.id_transaccion WHERE tr.id_cuota=${quotaExpression}
    AND (rr.estado IN ('SOLICITADO','PENDIENTE','INCIERTO','REVISION') OR rr.error_codigo='REFUND_REVIEW'
      OR (rr.estado='CONFIRMADO' AND rr.aplicado_en IS NULL)))
    OR EXISTS(SELECT 1 FROM EVENTO_RECURRENTE ev JOIN CHECKOUT_RECURRENTE co ON co.id_checkout=ev.id_checkout
      WHERE co.id_cuota=${quotaExpression} AND ev.tipo_evento='refund.create' AND ev.estado='REVISION'))`;
}
function assertRefundUnblocked(totals) {
  if (Number(totals.refund_bloqueante || 0)) throw new CheckoutError('CHECKOUT_REFUND_BLOCKED');
}
module.exports = { refundBlockingSql, assertRefundUnblocked };
