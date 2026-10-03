// Synthetic signatures only. Never load any real Recurrente credential.
const { randomUUID } = require("node:crypto");
const { Webhook } = require("svix");
const TEST_SECRET = `whsec_${Buffer.from("hu14-integration-signatures-only").toString("base64")}`;
const TEST_SANDBOX = "sbx_hu14_fixture";
const configuration = () => ({ secret: TEST_SECRET, sandboxId: TEST_SANDBOX, environment: "sandbox" });
function paymentPayload(checkout = {}, changes = {}) {
  return { event_type: "intent.succeeded", type: "payment", id: `in_TEST_${randomUUID().replaceAll("-", "")}`,
    status: "succeeded", raw_status: "succeeded", created_at: "2026-08-01T02:30:00.123456Z",
    amount_in_cents: Number(checkout.monto_centavos || 11500), currency: "GTQ", live_mode: false, sandbox_id: TEST_SANDBOX,
    checkout: { id: checkout.id_externo || "ch_TEST_fixture", status: "paid",
      ...(checkout.referencia_local ? { metadata: { nexus_checkout_reference: checkout.referencia_local } } : {}) },
    payment: { id: `pa_TEST_${randomUUID().replaceAll("-", "")}` }, ...changes };
}
function signed(payload, { svixId = `msg_TEST_${randomUUID().replaceAll("-", "")}`, time = new Date(), body } = {}) {
  const raw = body || Buffer.from(JSON.stringify(payload));
  return { raw, svixId, headers: { "svix-id": svixId, "svix-timestamp": String(Math.floor(time.getTime() / 1000)),
    "svix-signature": new Webhook(TEST_SECRET).sign(svixId, time, raw) } };
}
// Minimal sanitized contracts observed in real deliveries 348/349. All IDs,
// references and signatures below are synthetic; no captured customer/card data.
function observedPaymentPair(checkout = {}) {
  const intentId = `in_TEST_${randomUUID().replaceAll("-", "")}`;
  const paymentId = `pa_TEST_${randomUUID().replaceAll("-", "")}`;
  const amount = Number(checkout.monto_centavos ?? 500);
  const payment = { id: paymentId };
  const hosted = { id: checkout.id_externo || "ch_TEST_observed", status: "paid", live_mode: false,
    currency: "GTQ", total_in_cents: amount,
    latest_intent: { id: intentId, type: "PaymentIntent", created_at: "2026-10-02T17:05:21.546-06:00", data: {} },
    payment: { ...payment },
    ...(checkout.referencia_local ? { metadata: { nexus_checkout_reference: checkout.referencia_local } } : {}) };
  const common = { amount_in_cents: amount, currency: "GTQ", created_at: "2026-10-02T17:05:21.535-06:00",
    sandbox_id: TEST_SANDBOX, checkout: hosted, payment };
  return {
    paymentIntent: structuredClone({ ...common, event_type: "payment_intent.succeeded",
      id: `pa_TEST_${randomUUID().replaceAll("-", "")}`, live_mode: false, failure_reason: null }),
    intent: structuredClone({ ...common, event_type: "intent.succeeded", id: intentId, type: "payment", status: "succeeded" }),
  };
}
module.exports = { TEST_SECRET, TEST_SANDBOX, configuration, paymentPayload, observedPaymentPair, signed };
