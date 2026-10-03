jest.mock("../database/mysql", () => ({ query: jest.fn(), pool: {} }));
jest.mock("../services/authService", () => ({ getCurrentSession: jest.fn(), loginUser: jest.fn() }));
jest.mock("../services/activeSessionsService", () => ({ assertActiveSession: jest.fn() }));
const request = require("supertest");
const { createApp } = require("../app");
const { createSessionToken } = require("../services/sessionTokenService");
const { getCurrentSession } = require("../services/authService");
const { assertActiveSession } = require("../services/activeSessionsService");
const { CheckoutError } = require("../services/recurrenteCheckoutErrors");
const endpoint = "/residente/pagos/recurrente/checkout";
const service = { startResidentCheckout: jest.fn() };
const auth = () => `Bearer ${createSessionToken(4, "unit-active-session")}`;
beforeEach(() => {
  jest.clearAllMocks(); getCurrentSession.mockResolvedValue({ id: 4, role: "residente" }); assertActiveSession.mockResolvedValue();
  service.startResidentCheckout.mockResolvedValue({ referencia_local: "local-test", checkout_url: "https://app.recurrente.com/checkout-session/ch_test", secretKey: "FAKE_SHOULD_NOT_LEAK", estado: "PENDIENTE" });
});
test("identidad de sesion y respuesta limitada a referencia y URL", async () => {
  const response = await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ id_cuota: 3 }).expect(201);
  expect(service.startResidentCheckout).toHaveBeenCalledWith(4, 3);
  expect(assertActiveSession).toHaveBeenCalledWith(4, "unit-active-session");
  expect(Object.keys(response.body).sort()).toEqual(["checkout_url", "referencia_local"]);
  expect(JSON.stringify(response.body)).not.toContain("FAKE_SHOULD_NOT_LEAK");
});
test.each([undefined, "Bearer tampered"])("requiere token firmado %s y no acepta headers historicos", async (authorization) => {
  const req = request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("x-user-id", "4").set("x-user-role", "residente");
  if (authorization) req.set("Authorization", authorization);
  await req.send({ id_cuota: 3 }).expect(401); expect(service.startResidentCheckout).not.toHaveBeenCalled();
});
test.each(["administrador", "inquilino"])("rechaza rol actual %s", async (role) => {
  getCurrentSession.mockResolvedValue({ id: 4, role });
  await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ id_cuota: 3 }).expect(403);
  expect(service.startResidentCheckout).not.toHaveBeenCalled();
});
test("sesion revocada no inicia cobro", async () => {
  assertActiveSession.mockRejectedValue(Object.assign(new Error("Sesion revocada"), { status: 401 }));
  await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ id_cuota: 3 }).expect(401);
  expect(service.startResidentCheckout).not.toHaveBeenCalled();
});
test.each([{}, [], { id_cuota: 3, monto: 5 }, { id_cuota: 3, moneda: "USD" }, { id_cuota: 3, id_usuario: 7 }])("rechaza campos controlados por frontend %j", async (payload) => {
  await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send(payload).expect(400);
  expect(service.startResidentCheckout).not.toHaveBeenCalled();
});
test.each(["QUOTA_NOT_OWNED", "QUOTA_PAID", "CHECKOUT_MINIMUM", "CHECKOUT_TIMEOUT", "CHECKOUT_PROVIDER_AUTH", "CHECKOUT_PROVIDER_RATE_LIMIT", "CHECKOUT_PROVIDER_UNAVAILABLE", "CHECKOUT_INVALID_RESPONSE"])("expone solo error seguro %s", async (code) => {
  const error = new CheckoutError(code, { uncertain: true }); service.startResidentCheckout.mockRejectedValue(error);
  const response = await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ id_cuota: 3 }).expect(error.status);
  expect(response.body).toEqual({ message: error.message, code });
  expect(JSON.stringify(response.body)).not.toMatch(/X-SECRET-KEY|secretKey|stack|headers/);
});
