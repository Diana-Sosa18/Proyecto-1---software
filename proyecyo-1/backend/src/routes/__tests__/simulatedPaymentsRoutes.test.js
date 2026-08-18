const express = require("express");
const request = require("supertest");
jest.mock("../../controllers/residentAccountController", () => ({ getResidentAccountStatement: (_req, res) => res.json({}) }));
jest.mock("../../controllers/tenantAccountController", () => ({ getTenantAccountStatement: (_req, res) => res.json({}) }));
jest.mock("../../controllers/simulatedPaymentsController", () => ({
  postSimulatedPayment: (req, res) => res.status(201).json({ user: req.authUser.id, quota: req.body.id_cuota }),
}));
const routes = require("../residentAccountRoutes");
const tenantRoutes = require("../tenantAccountRoutes");
const app = express(); app.use(express.json()); app.use(routes); app.use(tenantRoutes); app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));

test("la ruta de pago residente exige su rol", async () => {
  await request(app).post("/residente/pagos-simulados").set("x-user-role", "inquilino").set("x-user-id", "4").send({ id_cuota: 3 }).expect(403);
});

test("la ruta inquilino exige su rol y usa su identidad", async () => {
  await request(app).post("/inquilino/pagos-simulados").set("x-user-role", "residente").set("x-user-id", "9").send({ id_cuota: 3 }).expect(403);
  const response = await request(app).post("/inquilino/pagos-simulados").set("x-user-role", "inquilino").set("x-user-id", "9").send({ id_cuota: 3 }).expect(201);
  expect(response.body).toEqual({ user: 9, quota: 3 });
});

test("la ruta autenticada usa la identidad de sesión", async () => {
  const response = await request(app).post("/residente/pagos-simulados").set("x-user-role", "residente").set("x-user-id", "4").send({ id_cuota: 3 }).expect(201);
  expect(response.body).toEqual({ user: 4, quota: 3 });
});
