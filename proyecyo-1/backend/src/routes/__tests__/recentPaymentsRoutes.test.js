const express = require("express"); const request = require("supertest");
jest.mock("../../controllers/adminPaymentsController", () => ({ getAdminPayments: (_q,r)=>r.json([]), getMonthlyReport: (_q,r)=>r.json({}), getRecentPayments: (req,res)=>res.json([{ admin: req.authUser.id }]) }));
const routes = require("../adminPaymentsRoutes"); const app = express(); app.use(routes); app.use((e,_q,r,_n)=>r.status(e.status||500).json({message:e.message}));
test("solo el administrador consulta pagos recientes", async () => {
  await request(app).get("/admin/pagos/recientes").set("x-user-role","residente").set("x-user-id","4").expect(403);
  const response = await request(app).get("/admin/pagos/recientes").set("x-user-role","admin").set("x-user-id","1").expect(200);
  expect(response.body).toEqual([{ admin: 1 }]);
});
