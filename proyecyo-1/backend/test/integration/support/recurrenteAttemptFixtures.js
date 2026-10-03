const { randomUUID } = require("node:crypto");
const { TEST_SANDBOX } = require("./recurrenteWebhookFixtures");
// Documented unified/legacy fields only, with synthetic local identity and
// explicit Sandbox fields required by NexusResidencial's existing HU14 guard.
function attemptPayload(local = {}, { canceled = false, reason = "El banco ha rechazado la transacción." } = {}) {
  return { event_type: canceled ? "intent.canceled" : "intent.failed", type: "payment",
    id: `in_TEST_${randomUUID().replaceAll("-", "")}`, status: canceled ? "canceled" : "failed",
    raw_status: canceled ? "canceled" : "failed", created_at: "2026-10-02T12:30:00.123456-06:00",
    amount_in_cents: Number(local.monto_centavos ?? 11500), currency: "GTQ", sandbox_id: TEST_SANDBOX,
    checkout: { id: local.id_externo || "ch_TEST_attempt", live_mode: false, status: "unpaid",
      ...(local.referencia_local ? { metadata: { nexus_checkout_reference: local.referencia_local } } : {}) },
    details: { failure_reason: reason } };
}
function legacyAttempt(unified, { canonical = true } = {}) {
  const checkout = structuredClone(unified.checkout);
  if (canonical) checkout.latest_intent = { id: unified.id, type: "PaymentIntent" };
  return { id: `pa_TEST_${randomUUID().replaceAll("-", "")}`, event_type: "payment_intent.failed",
    created_at: unified.created_at, amount_in_cents: unified.amount_in_cents, currency: "GTQ",
    sandbox_id: TEST_SANDBOX, live_mode: false, checkout, failure_reason: unified.details.failure_reason };
}
module.exports = { attemptPayload, legacyAttempt };
