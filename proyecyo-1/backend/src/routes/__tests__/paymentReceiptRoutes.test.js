jest.mock("../../services/paymentReceiptService", () => ({
  getPaymentReceipt: jest.fn(), createPaymentReceiptPdf: jest.fn(),
}));
const express = require("express");
const request = require("supertest");
const service = require("../../services/paymentReceiptService");
const routes = require("../paymentReceiptRoutes");

const app = express(); app.use(routes); app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
beforeEach(() => jest.clearAllMocks());

test("residente descarga PDF propio", async () => {
  service.getPaymentReceipt.mockResolvedValue({ numero_comprobante: "NXR-00000001" });
  service.createPaymentReceiptPdf.mockResolvedValue(Buffer.from("%PDF-test"));
  const response = await request(app).get("/residente/pagos/1/comprobante").set("x-user-role", "residente").set("x-user-id", "4");
  expect(response.status).toBe(200); expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  expect(service.getPaymentReceipt).toHaveBeenCalledWith(4, "residente", "1");
});

test("bloquea roles cruzados", async () => {
  const response = await request(app).get("/inquilino/pagos/1/comprobante").set("x-user-role", "residente").set("x-user-id", "4");
  expect(response.status).toBe(403); expect(service.getPaymentReceipt).not.toHaveBeenCalled();
});

test("propaga pago inexistente", async () => {
  service.getPaymentReceipt.mockRejectedValue(Object.assign(new Error("No encontrado"), { status: 404 }));
  const response = await request(app).get("/inquilino/pagos/99/comprobante").set("x-user-role", "inquilino").set("x-user-id", "8");
  expect(response.status).toBe(404);
});
