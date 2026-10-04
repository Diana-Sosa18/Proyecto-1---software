const {randomUUID}=require('node:crypto');
const {observedPaymentPair}=require('./recurrenteWebhookFixtures');
// Structure observed in four real deliveries; all identities are synthetic.
// Different PaymentIntent attempts may share checkout.payment.id.
function failedThenSucceeded(local) {
  const success=observedPaymentPair(local);
  const failed=structuredClone(success.intent);
  failed.id=`in_TEST_${randomUUID().replaceAll('-','')}`;
  failed.event_type='intent.failed';failed.status='failed';
  failed.created_at='2026-10-02T12:30:00.123456-06:00';
  failed.details={failure_reason:'Fallo TEST sin datos de tarjeta'};
  failed.checkout.status='unpaid';failed.checkout.latest_intent.id=failed.id;
  const legacy=structuredClone(failed);
  legacy.event_type='payment_intent.failed';legacy.id=`pa_TEST_${randomUUID().replaceAll('-','')}`;
  legacy.failure_reason=failed.details.failure_reason;delete legacy.details;
  return {failed,legacy,success};
}
module.exports={failedThenSucceeded};
