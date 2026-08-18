jest.mock("../../services/adminPaymentsService", () => ({ listDelinquentResidents: jest.fn(), getMonthlyFinancialReport: jest.fn() }));
const express=require("express"), request=require("supertest"), service=require("../../services/adminPaymentsService"), routes=require("../adminPaymentsRoutes");
const app=express();app.use(routes);app.use((e,_q,r,_n)=>r.status(e.status||500).json({message:e.message}));
test("reporte mensual requiere administrador", async()=>{expect((await request(app).get("/admin/reportes/financiero-mensual?mes=8&anio=2026")).status).toBe(403);});
test("administrador consulta periodo", async()=>{service.getMonthlyFinancialReport.mockResolvedValue({resumen:{},detalle:[]});const response=await request(app).get("/admin/reportes/financiero-mensual?mes=8&anio=2026").set("x-user-role","admin").set("x-user-id","1");expect(response.status).toBe(200);expect(service.getMonthlyFinancialReport).toHaveBeenCalledWith("8","2026");});
