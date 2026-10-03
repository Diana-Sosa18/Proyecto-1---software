jest.mock("../database/mysql", () => ({ query: jest.fn(), pool: {} }));
jest.mock("../services/authService", () => ({ loginUser: jest.fn(), getCurrentSession: jest.fn() }));
const request = require("supertest");
const zlib = require("node:zlib");
const { createApp } = require("../app");
const { loginUser } = require("../services/authService");
test("conserva exactamente bytes, espacios, Unicode y CRLF antes de express.json", async () => {
  const original = Buffer.from('{\r\n "texto": "á", "valor": 5.00 }\r\n');
  let received;
  const app = createApp({ recurrenteWebhookHandler: (req, res) => { received = req.rawBody; res.sendStatus(204); } });
  await request(app).post("/webhooks/recurrente").set("Content-Type", "application/json")
    .set("svix-id", "test-event").serialize((data) => data).send(original).expect(204);
  expect(Buffer.isBuffer(received)).toBe(true);
  expect(received.equals(original)).toBe(true);
});
test("webhook por defecto falla cerrado sin signing secret", async () => {
  await request(createApp()).post("/webhooks/recurrente").send({ event: "test" }).expect(503);
});
test("rutas JSON normales siguen recibiendo objetos y health funciona", async () => {
  loginUser.mockResolvedValueOnce({ ok: true });
  const app = createApp({ recurrenteWebhookHandler: (_req, res) => res.sendStatus(204) });
  const payload = { email: "test@example.invalid", password: "test-only" };
  await request(app).post("/login").send(payload).expect(200);
  expect(loginUser.mock.calls.at(-1)[0]).toEqual(payload);
  await request(app).get("/health").expect(200, { status: "ok" });
  await request(app).get("/admin/pagos").expect(401);
  await request(app).get("/residente/estado-cuenta").expect(401);
});
test("rechaza JSON malformado en rutas normales", async () => {
  await request(createApp()).post("/login").set("Content-Type", "application/json").send('{"broken":').expect(400);
});
test("webhook rechaza compresion y tipos que alterarian los bytes", async () => {
  const handler = jest.fn((_req, res) => res.sendStatus(204));
  const app = createApp({ recurrenteWebhookHandler: handler });
  await request(app).post("/webhooks/recurrente").set("Content-Type", "text/plain").send("test").expect(415);
  await request(app).post("/webhooks/recurrente").set("Content-Type", "application/json")
    .set("Content-Encoding", "gzip").serialize((data) => data).send(zlib.gzipSync(Buffer.from("{}"))).expect(415);
  expect(handler).not.toHaveBeenCalled();
});
