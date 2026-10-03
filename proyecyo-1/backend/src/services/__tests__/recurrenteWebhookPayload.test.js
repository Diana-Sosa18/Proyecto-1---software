const { verifyWebhook, inspectEvent, paymentTime } = require("../recurrenteWebhookPayload");
const { configuration, paymentPayload, observedPaymentPair, signed } = require("../../../test/integration/support/recurrenteWebhookFixtures");
test("firma oficial sobre Buffer original con Unicode, espacios y CRLF", () => {
  const raw = Buffer.from('{\r\n "event_type": "intent.succeeded", "texto": "á", "monto": 5.00 }\r\n');
  const f = signed(null, { body: raw });
  expect(verifyWebhook(raw, f.headers, configuration()).payload.texto).toBe("á");
  expect(() => verifyWebhook(Buffer.from(JSON.stringify(JSON.parse(raw))), f.headers, configuration())).toThrow();
});
test.each(["svix-id", "svix-timestamp", "svix-signature"])("rechaza header %s ausente", (key) => {
  const f = signed(paymentPayload()); delete f.headers[key];
  expect(() => verifyWebhook(f.raw, f.headers, configuration())).toThrow();
});
test.each([-301000, 301000])("rechaza timestamp Svix fuera de ventana %i", (delta) => {
  const f = signed(paymentPayload(), { time: new Date(Date.now() + delta) });
  expect(() => verifyWebhook(f.raw, f.headers, configuration())).toThrow();
});
test("Buffer alterado y firma incorrecta no pasan", () => {
  const f = signed(paymentPayload());
  expect(() => verifyWebhook(Buffer.concat([f.raw, Buffer.from(" ")]), f.headers, configuration())).toThrow();
  expect(() => verifyWebhook(f.raw, { ...f.headers, "svix-signature": "v1,invalid" }, configuration())).toThrow();
});
test("no acepta objeto parseado en lugar del body original", () => {
  expect(() => verifyWebhook({}, {}, configuration())).toThrow();
});
test("no normaliza bytes UTF8 invalidos antes de la firma", () => {
  const raw = Buffer.from([123, 34, 97, 34, 58, 34, 255, 34, 125]);
  const f = signed(null, { body: raw });
  expect(() => verifyWebhook(raw, f.headers, configuration())).toThrow();
});
test("envelope Svix documentado se verifica antes de seleccionar data", () => {
  const payload = paymentPayload(), f = signed({ eventType: payload.event_type, eventId: "TEST", data: payload });
  expect(verifyWebhook(f.raw, f.headers, configuration()).payload).toEqual(payload);
});
test("rechaza envelope ambiguo", () => {
  const f = signed({ ...paymentPayload(), data: paymentPayload() });
  expect(() => verifyWebhook(f.raw, f.headers, configuration())).toThrow();
});
test("selecciona solo succeeded/payment con Sandbox explicito", () => {
  expect(inspectEvent(paymentPayload(), configuration().sandboxId).disposition).toBe("PAYMENT");
});
test.each([{ live_mode: true }, { live_mode: undefined }, { live_mode: "false" }, { sandbox_id: "sbx_other" }, { sandbox_id: undefined }])("ambiente no verificable no aplica", (changes) => {
  expect(inspectEvent(paymentPayload({}, changes), configuration().sandboxId).disposition).toBe("IGNORADO");
});
test.each([{ event_type: "refund.create" }, { event_type: "subscription.create" }, { type: "bank_transfer" }])("fuente financiera diferente se ignora", (changes) => {
  expect(inspectEvent(paymentPayload({}, changes), configuration().sandboxId).disposition).toBe("IGNORADO");
});
test("payment_intent.succeeded incompleto se reconoce y requiere revision", () => {
  const event = inspectEvent(paymentPayload({}, { event_type: "payment_intent.succeeded" }), configuration().sandboxId);
  expect(event).toMatchObject({ disposition: "REVISION", code: "WEBHOOK_PAYMENT_INVALID" });
});
test("contratos reales 348/349 convergen en intent y payment estables", () => {
  const pair = observedPaymentPair();
  const events = [pair.paymentIntent, pair.intent].map((payload) => inspectEvent(payload, configuration().sandboxId));
  for (const event of events) expect(event).toMatchObject({ disposition: "PAYMENT", externalId: pair.intent.id,
    paymentId: pair.intent.payment.id, liveMode: false, environment: "sandbox", amount: 500, currency: "GTQ",
    time: { accountingDate: "2026-10-02", utc: "2026-10-02 23:05:21.535000" } });
  expect(events[0].sourceId).toBe(pair.paymentIntent.id);
  expect(events[1].sourceId).toBe(pair.intent.id);
});
test.each([
  (p) => { p.live_mode = true; },
  (p) => { p.live_mode = "false"; },
  (p) => { p.live_mode = null; },
  (p) => { p.live_mode = false; p.checkout.live_mode = true; },
  (p) => { p.live_mode = true; p.checkout.live_mode = false; },
  (p) => { p.checkout.live_mode = null; },
  (p) => { delete p.checkout.live_mode; },
  (p) => { p.sandbox_id = "sbx_foreign"; },
  (p) => { delete p.sandbox_id; },
  (p) => { p.checkout.sandbox_id = "sbx_foreign"; },
])("no elige una ubicacion favorable cuando el ambiente es contradictorio o incompleto", (change) => {
  const { intent } = observedPaymentPair(); change(intent);
  expect(inspectEvent(intent, configuration().sandboxId)).toMatchObject({ disposition: "IGNORADO", code: "WEBHOOK_ENVIRONMENT_MISMATCH" });
});
test.each([
  (p) => { p.checkout.latest_intent.id = "in_TEST_other"; },
  (p) => { p.checkout.latest_intent.type = "SubscriptionIntent"; },
  (p) => { p.checkout.payment.id = "pa_TEST_other"; },
  (p) => { p.checkout.status = "unpaid"; },
  (p) => { p.status = "pending"; },
])("identidades o estados contradictorios no se aplican", (change) => {
  const { intent } = observedPaymentPair(); change(intent);
  expect(inspectEvent(intent, configuration().sandboxId)).toMatchObject({ disposition: "REVISION", code: "WEBHOOK_PAYMENT_INVALID" });
});
test.each([
  (p) => { delete p.checkout.latest_intent; },
  (p) => { delete p.payment; delete p.checkout.payment; },
  (p) => { p.failure_reason = "TEST rejected"; },
  (p) => { p.checkout.status = "unpaid"; },
])("payment_intent exige evidencia de checkout pagado e identificadores compartidos", (change) => {
  const { paymentIntent } = observedPaymentPair(); change(paymentIntent);
  expect(inspectEvent(paymentIntent, configuration().sandboxId)).toMatchObject({ disposition: "REVISION", code: "WEBHOOK_PAYMENT_INVALID" });
});
test.each([
  [(p) => { p.checkout.total_in_cents = 501; }, "WEBHOOK_AMOUNT_MISMATCH"],
  [(p) => { p.checkout.currency = "USD"; }, "WEBHOOK_CURRENCY_MISMATCH"],
])("no normaliza importes o monedas contradictorios", (change, code) => {
  const { intent } = observedPaymentPair(); change(intent);
  expect(inspectEvent(intent, configuration().sandboxId)).toMatchObject({ disposition: "REVISION", code });
});
test.each([{ amount_in_cents: "11500" }, { amount_in_cents: 1.1 }, { amount_in_cents: 0 }, { amount_in_cents: Number.MAX_SAFE_INTEGER + 1 },
  { currency: "USD" }, { created_at: null }, { checkout: null }, { id: "bad\nID" }, { status: "pending" }])("datos financieros incompletos se revisan sin inventarlos", (changes) => {
  expect(inspectEvent(paymentPayload({}, changes), configuration().sandboxId).disposition).toBe("REVISION");
});
test.each([
  ["2026-08-01T02:30:00.123456Z", "2026-07-31", "2026-08-01 02:30:00.123456"],
  ["2026-08-01T08:00:00+02:00", "2026-08-01", "2026-08-01 06:00:00.000000"],
  ["2026-08-01T00:00:00-06:00", "2026-08-01", "2026-08-01 06:00:00.000000"],
])("fecha %s se convierte explicitamente a Guatemala", (value, date, utc) => {
  expect(paymentTime(value)).toEqual({ original: value, utc, accountingDate: date });
});
test.each([null, "", "2026-08-01", "2026-08-01T02:30:00", "2026-02-30T00:00:00Z", "2026-08-01T25:00:00Z",
  "2026-08-01T02:30:00+14:01", "2026-08-01T02:30:00.1234567Z", "2026-08-01T02:30:00+02:99"])("no inventa fecha para %s", (value) => {
  expect(paymentTime(value)).toBeNull();
});
