jest.mock("../database/mysql", () => ({ query: jest.fn(), pool: {} }));
const request = require("supertest");
const { createApp } = require("../app");
const { createWebhookHandler } = require("../controllers/recurrenteWebhookController");
const { createWebhookService } = require("../services/recurrenteWebhookService");
const { configuration, paymentPayload, observedPaymentPair, signed } = require("../../test/integration/support/recurrenteWebhookFixtures");
let service, app;
beforeEach(() => {
  service = { receive: jest.fn().mockResolvedValue("processed") };
  app = createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration, service }) });
});
const send = (f) => request(app).post("/webhooks/recurrente").set("Content-Type", "application/json")
  .set(f.headers).serialize((data) => data).send(f.raw);
test("endpoint sin sesion acepta firma valida; respuesta no incluye payload", async () => {
  const f = signed(paymentPayload());
  await send(f).expect(200, { received: true, result: "processed" });
  expect(service.receive).toHaveBeenCalledWith(expect.objectContaining({ hash: expect.any(String), svixId: f.svixId,
    event: expect.objectContaining({ disposition: "PAYMENT" }), payload: undefined }));
});
test("sin signing secret falla cerrado sin tocar DB", async () => {
  app = createApp({ recurrenteWebhookHandler: createWebhookHandler({ configuration: () => { throw Object.assign(new Error("INTERNAL_SECRET_TEST"), { status: 503, code: "WEBHOOK_UNAVAILABLE" }); }, service }) });
  const res = await send(signed(paymentPayload())).expect(503);
  expect(JSON.stringify(res.body)).not.toContain("INTERNAL_SECRET_TEST"); expect(service.receive).not.toHaveBeenCalled();
});
test("sin firma no procesa", async () => {
  await request(app).post("/webhooks/recurrente").send(paymentPayload()).expect(401);
  expect(service.receive).not.toHaveBeenCalled();
});
test("body alterado no procesa", async () => {
  const f = signed(paymentPayload()); f.raw = Buffer.concat([f.raw, Buffer.from(" ")]);
  await send(f).expect(401); expect(service.receive).not.toHaveBeenCalled();
});
test("JSON malformado con firma valida responde 400 sin aplicar ni registrar", async () => {
  await send(signed(null, { body: Buffer.from('{"event_type":') })).expect(400);
  expect(service.receive).not.toHaveBeenCalled();
});
test("error DB temporal responde 503 sin detalles ni falsa aceptacion", async () => {
  service.receive.mockRejectedValue(new Error("SQL_PRIVATE_TEST"));
  const res = await send(signed(paymentPayload())).expect(503);
  expect(res.body.code).toBe("WEBHOOK_RETRY"); expect(JSON.stringify(res.body)).not.toContain("SQL_PRIVATE_TEST");
});
test.each(["duplicate", "ignored", "review"])("resultado %s confirmado por inbox responde 200", async (result) => {
  service.receive.mockResolvedValue(result); await send(signed(paymentPayload())).expect(200, { received: true, result });
});
test("body de mensaje diferente con mismo svix-id responde 409", async () => {
  service.receive.mockRejectedValue(Object.assign(new Error("safe"), { code: "WEBHOOK_EVENT_CONFLICT", status: 409 }));
  await send(signed(paymentPayload())).expect(409);
});
test("checkout pendiente de persistencia permite reintento 503", async () => {
  service.receive.mockRejectedValue(Object.assign(new Error("safe"), { code: "WEBHOOK_CHECKOUT_NOT_READY", status: 503 }));
  await send(signed(paymentPayload())).expect(503);
});
test("conexion SQL no disponible produce error seguro de servicio", async () => {
  const failed = createWebhookService({ pool: { getConnection: async () => { throw new Error("DB_PRIVATE_TEST"); } } });
  await expect(failed.receive({})).rejects.toMatchObject({ code: "WEBHOOK_RETRY", status: 503 });
});
test.each(["paymentIntent", "intent"])("ruta normaliza contrato real %s solo despues de verificar Svix", async (kind) => {
  const pair = observedPaymentPair();
  await send(signed(pair[kind])).expect(200);
  expect(service.receive).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({
    disposition: "PAYMENT", externalId: pair.intent.id, paymentId: pair.intent.payment.id, liveMode: false,
  }) }));
});
test.each(["paymentIntent", "intent"])("contrato real %s con firma invalida no persiste ni aplica", async (kind) => {
  const body = signed(observedPaymentPair()[kind]); body.headers["svix-signature"] = "v1,invalid";
  await send(body).expect(401); expect(service.receive).not.toHaveBeenCalled();
});
