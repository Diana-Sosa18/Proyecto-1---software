jest.mock("../../services/paymentReceiptService", () => ({ getPaymentReceipt: jest.fn(), getResidentTransactionReceipt: jest.fn(), listResidentRecurrenteReceipts: jest.fn(), createPaymentReceiptPdf: jest.fn() }));
jest.mock("../../services/authService", () => ({ getCurrentSession: jest.fn() }));
jest.mock("../../services/activeSessionsService", () => ({ assertActiveSession: jest.fn() }));
const request = require("supertest"), express = require("express");
const service = require("../../services/paymentReceiptService");
const { getCurrentSession } = require("../../services/authService"), { assertActiveSession } = require("../../services/activeSessionsService");
const { createSessionToken } = require("../../services/sessionTokenService");
const routes = require("../paymentReceiptRoutes");
const auth = () => `Bearer ${createSessionToken(3, "hu16-unit-session")}`;
const app = express(); app.use(routes); app.use((e, _req, res, _next) => res.status(e.status || 500).json({ code: e.code, message: e.status < 500 ? e.message : "Error interno" }));
const paths = ["/residente/pagos/395/comprobante/datos", "/residente/pagos/recurrente/comprobantes", "/residente/pagos/recurrente/transacciones/296/comprobante"];
beforeEach(() => { jest.clearAllMocks(); getCurrentSession.mockResolvedValue({ id: 3, role: "residente" }); assertActiveSession.mockResolvedValue();
  service.getPaymentReceipt.mockResolvedValue({ id_pago: 395, numero_comprobante: "NXR-00000395" }); service.getResidentTransactionReceipt.mockResolvedValue({ id_pago: 395 }); service.listResidentRecurrenteReceipts.mockResolvedValue([]); });
test("JSON usa identidad de sesión e ignora identidades/montos de query", async () => {
  const response = await request(app).get(paths[0]+"?id_usuario=4&email=otro@test.com&monto=500").set("Authorization", auth()).expect(200);
  expect(service.getPaymentReceipt).toHaveBeenCalledWith(3, "residente", "395"); expect(response.headers["cache-control"]).toBe("private, no-store");
});
test.each(paths)("sin sesión o con cabeceras falsificadas se bloquea %s", async (path) => {
  await request(app).get(path).expect(401); await request(app).get(path).set("x-user-id", "3").set("x-user-role", "residente").expect(401);
  expect(service.getPaymentReceipt).not.toHaveBeenCalled(); expect(service.getResidentTransactionReceipt).not.toHaveBeenCalled(); expect(service.listResidentRecurrenteReceipts).not.toHaveBeenCalled();
});
test.each(["administrador", "inquilino", "guardia"])("rol %s no adquiere acceso a comprobantes de residente", async (role) => {
  getCurrentSession.mockResolvedValue({ id: 3, role }); for (const path of paths) await request(app).get(path).set("Authorization", auth()).expect(403);
});
test("sesión revocada no permite acceso", async () => { assertActiveSession.mockRejectedValue(Object.assign(new Error("Sesión inválida"), { status: 401 })); await request(app).get(paths[0]).set("Authorization", auth()).expect(401); });
test.each([404, 409])("pago inexistente/no confirmado no devuelve PDF ni comprobante (%s)", async (status) => {
  service.getPaymentReceipt.mockRejectedValue(Object.assign(new Error("Comprobante no disponible"), { status }));
  await request(app).get(paths[0]).set("Authorization", auth()).expect(status);
  await request(app).get("/residente/pagos/395/comprobante").set("Authorization", auth()).expect(status);
  expect(service.createPaymentReceiptPdf).not.toHaveBeenCalled();
});
