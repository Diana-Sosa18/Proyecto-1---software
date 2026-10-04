// A signed success needing review is evidence of a possible external charge.
// No timers, browser parameters or failed-attempt messages can release it.
function successReviewSql(checkoutExpression) {
  return `EXISTS(SELECT 1 FROM EVENTO_RECURRENTE er WHERE er.id_checkout=${checkoutExpression}
    AND er.ambiente='sandbox' AND er.estado='REVISION'
    AND er.tipo_evento IN ('payment_intent.succeeded','intent.succeeded'))`;
}
module.exports={successReviewSql};
