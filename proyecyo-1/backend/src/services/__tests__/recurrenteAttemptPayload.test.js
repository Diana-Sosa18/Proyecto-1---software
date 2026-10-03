const { inspectEvent, verifyWebhook } = require("../recurrenteWebhookPayload");
const { failureReason } = require("../recurrenteAttemptPayload");
const { attemptPayload, legacyAttempt } = require("../../../test/integration/support/recurrenteAttemptFixtures");
const { configuration, signed, TEST_SANDBOX, observedPaymentPair } = require("../../../test/integration/support/recurrenteWebhookFixtures");

test.each([false, true])("contrato unificado documentado canceled=%s se normaliza sin confirmar pago", (canceled) => {
  const payload = attemptPayload({}, { canceled });
  const event = inspectEvent(payload, TEST_SANDBOX);
  expect(event).toMatchObject({ disposition: "ATTEMPT", attemptState: canceled ? "CANCELADA" : "FALLIDA",
    externalId: payload.id, liveMode: false, currency: "GTQ", amount: 11500,
    time: { utc: "2026-10-02 18:30:00.123456", original: payload.created_at } });
});
test("legacy con latest_intent converge con el ID unificado", () => {
  const unified = attemptPayload(), legacy = legacyAttempt(unified);
  expect(inspectEvent(legacy, TEST_SANDBOX)).toMatchObject({ disposition: "ATTEMPT", externalId: unified.id, sourceId: legacy.id });
});
test("legacy mínimo retiene el fallo sin inventar un intent canónico", () => {
  const event = inspectEvent(legacyAttempt(attemptPayload(), { canonical: false }), TEST_SANDBOX);
  expect(event).toMatchObject({ disposition: "ATTEMPT", externalId: null, attemptState: "FALLIDA" });
});
test("legacy fallido con checkout paid no atribuye el fallo a su último intento exitoso", () => {
  const legacy = legacyAttempt(attemptPayload()); legacy.checkout.status = "paid";
  expect(inspectEvent(legacy, TEST_SANDBOX).disposition).toBe("REVISION");
});
test.each([
  { live_mode: true }, { live_mode: "false" }, { sandbox_id: "sbx_OTHER" }, { sandbox_id: undefined },
])("ambiente contradictorio o ajeno queda ignorado %j", (change) => {
  expect(inspectEvent({ ...attemptPayload(), ...change }, TEST_SANDBOX)).toMatchObject({ disposition: "IGNORADO", code: "WEBHOOK_ENVIRONMENT_MISMATCH" });
});
test.each([
  { status: "succeeded" }, { id: "pa_NOT_CANONICAL" }, { amount_in_cents: -1 }, { amount_in_cents: 1.2 },
  { amount_in_cents: 10000000000 }, { currency: "USD" }, { created_at: "2026-02-30T00:00:00Z" },
  { checkout: { id: "ch_TEST", live_mode: false, latest_intent: { id: "in_OTHER", type: "PaymentIntent" } } },
  { checkout: { id: "ch_TEST", live_mode: false, total_in_cents: 999 } },
  { checkout: { id: "ch_TEST", live_mode: false, metadata: { nexus_checkout_reference: "bad" } } },
])("identidad, fecha y monto inconsistentes van a revisión %j", (change) => {
  expect(inspectEvent({ ...attemptPayload(), ...change }, TEST_SANDBOX).disposition).toBe("REVISION");
});
test("sin fecha de proveedor no se inventa fecha contable ni hora del servidor", () => {
  const p = attemptPayload(); delete p.created_at;
  expect(inspectEvent(p, TEST_SANDBOX)).toMatchObject({ disposition: "ATTEMPT", time: null });
});
test.each(["payment_intent.canceled", "payment_intent.cancelled", "refund.create", "unknown.event"])(
  "no inventa soporte para %s", (event_type) => expect(inspectEvent({ ...attemptPayload(), event_type }, TEST_SANDBOX).disposition).toBe("IGNORADO"),
);
test.each([
  ["El banco ha rechazado la transacción.", "BANK_DECLINED"], ["Insufficient funds", "INSUFFICIENT_FUNDS"],
  ["Timeout al procesar", "INTENT_FAILED"], [null, "INTENT_FAILED"], ["insufficient_funds", "INSUFFICIENT_FUNDS"],
])("motivo clasificado en catálogo local %s", (reason, code) => expect(failureReason(reason).code).toBe(code));
test("no conserva tarjeta, CVC, credenciales ni datos personales incluso en un motivo firmado", () => {
  const unsafe = "El banco rechazó; PAN TEST 4111111111111111 CVC 123 sk_test_FAKE_ONLY whsec_FAKE_ONLY correo test@example.test";
  const result = failureReason(unsafe);
  expect(result.code).toBe("BANK_DECLINED");
  expect(JSON.stringify(result)).not.toMatch(/411111|CVC|123|sk_test|whsec|@/);
});
test("rechazo firmado verifica el body original y firma adulterada se rechaza", () => {
  const f = signed(attemptPayload()); expect(verifyWebhook(f.raw, f.headers, configuration()).payload.event_type).toBe("intent.failed");
  expect(() => verifyWebhook(Buffer.concat([f.raw, Buffer.from(" ")]), f.headers, configuration())).toThrow();
});
test("normalización exitosa HU14 permanece intacta", () => {
  const pair = observedPaymentPair();
  for (const p of [pair.paymentIntent, pair.intent]) expect(inspectEvent(p, TEST_SANDBOX).disposition).toBe("PAYMENT");
});
