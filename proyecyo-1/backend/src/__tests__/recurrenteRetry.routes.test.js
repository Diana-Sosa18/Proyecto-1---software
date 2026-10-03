jest.mock("../database/mysql", () => ({ query: jest.fn(), pool: {} }));
jest.mock("../services/authService", () => ({ getCurrentSession: jest.fn(), loginUser: jest.fn() }));
jest.mock("../services/activeSessionsService", () => ({ assertActiveSession: jest.fn() }));
const request = require("supertest");
const { createApp } = require("../app");
const { createSessionToken } = require("../services/sessionTokenService");
const { getCurrentSession } = require("../services/authService");
const { assertActiveSession } = require("../services/activeSessionsService");
const { CheckoutError } = require("../services/recurrenteCheckoutErrors");
const reference = "00000000-0000-4000-8000-000000000015";
const endpoint = "/residente/pagos/recurrente/reintentar";
const statusPath = `/residente/pagos/recurrente/checkouts/${reference}`;
const service = { retryResidentCheckout: jest.fn(), residentCheckoutStatus: jest.fn() };
const auth = () => `Bearer ${createSessionToken(3, "hu15-unit-session")}`;
beforeEach(() => {
  jest.clearAllMocks(); getCurrentSession.mockResolvedValue({ id: 3, role: "residente" }); assertActiveSession.mockResolvedValue();
  service.retryResidentCheckout.mockResolvedValue({ referencia_local: reference, checkout_url: "https://app.recurrente.com/checkout-session/ch_TEST", raw: "DO_NOT_EXPOSE_TEST" });
  service.residentCheckoutStatus.mockResolvedValue({ referencia_local: reference, estado: "RECHAZADO", mensaje: "El intento fue rechazado.", accion: "CONTINUAR", raw: "DO_NOT_EXPOSE_TEST" });
});
test("retry recibe solo referencia opaca e identidad desde sesión, devuelve solamente URL y referencia", async () => {
  const res = await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ referencia_local: reference }).expect(201);
  expect(service.retryResidentCheckout).toHaveBeenCalledWith(3, reference);
  expect(Object.keys(res.body).sort()).toEqual(["checkout_url", "referencia_local"]); expect(JSON.stringify(res.body)).not.toContain("DO_NOT_EXPOSE_TEST");
});
test("estado usa autorización y respuestas sin cache, IDs externos ni motivos crudos", async () => {
  const res = await request(createApp({ recurrenteCheckoutService: service })).get(statusPath).set("Authorization", auth()).expect(200);
  expect(service.residentCheckoutStatus).toHaveBeenCalledWith(3, reference); expect(res.headers["cache-control"]).toBe("no-store");
  expect(Object.keys(res.body).sort()).toEqual(["accion", "estado", "mensaje", "referencia_local"]);
});
test.each(["retry", "status"])("%s requiere sesión vigente", async (kind) => {
  const app = createApp({ recurrenteCheckoutService: service });
  await (kind === "retry" ? request(app).post(endpoint).send({ referencia_local: reference }) : request(app).get(statusPath)).expect(401);
  expect(service.retryResidentCheckout).not.toHaveBeenCalled(); expect(service.residentCheckoutStatus).not.toHaveBeenCalled();
});
test.each(["administrador", "inquilino"])("otro rol %s no accede a retry ni estado", async (role) => {
  getCurrentSession.mockResolvedValue({ id: 3, role }); const app = createApp({ recurrenteCheckoutService: service });
  await request(app).post(endpoint).set("Authorization", auth()).send({ referencia_local: reference }).expect(403);
  await request(app).get(statusPath).set("Authorization", auth()).expect(403);
});
test.each([{}, [], { referencia_local: reference, monto: 5 }, { referencia_local: reference, moneda: "USD" }, { referencia_local: reference, usuario: 3 }])(
  "retry rechaza monto, moneda o identidad enviada por navegador %j", async (body) => {
    await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send(body).expect(400);
    expect(service.retryResidentCheckout).not.toHaveBeenCalled();
  },
);
test.each(["CHECKOUT_UNCERTAIN", "CHECKOUT_NOT_USABLE", "CHECKOUT_INCOMPATIBLE", "CHECKOUT_NOT_FOUND", "QUOTA_PAID", "CHECKOUT_TIMEOUT"])(
  "error seguro %s sin datos del proveedor", async (code) => {
    const error = new CheckoutError(code); service.retryResidentCheckout.mockRejectedValue(error);
    const res = await request(createApp({ recurrenteCheckoutService: service })).post(endpoint).set("Authorization", auth()).send({ referencia_local: reference }).expect(error.status);
    expect(res.body).toEqual({ message: error.message, code }); expect(JSON.stringify(res.body)).not.toMatch(/headers|stack|secret|raw/);
  },
);
