const assert = require("node:assert/strict");
const { test, mock, afterEach } = require("node:test");
const ExcelJS = require("exceljs");
const request = require("supertest");
const express = require("express");
const db = require("../src/database/mysql");
const query = mock.method(db, "query", async () => []);
const s = require("../src/services/reportExportService");
const router = require("../src/routes/reportExportRoutes");
const app = express();
app.use(router);
app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
afterEach(() => { query.mock.resetCalls(); query.mock.mockImplementation(async () => []); });

test("HU10 valida formatos, fechas reales y parámetros repetidos", () => {
  assert.deepEqual(s.validate("accesos", "pdf"), { type: "accesos", format: "pdf" });
  for (const type of ["otro", "constructor", "__proto__", ["accesos"]]) assert.throws(() => s.validate(type, "pdf"), { status: 400 });
  assert.throws(() => s.validate("accesos", "csv"), { status: 400 });
  for (const desde of ["2026-02-29", "2026-04-31", "2026-13-01", ["2026-01-01"], "invalid"]) assert.throws(() => s.validateFilters({ desde }), { status: 400 });
  assert.equal(s.validateFilters({ desde: "2024-02-29" }).desde, "2024-02-29");
  assert.throws(() => s.validateFilters({ desde: "2026-12-31", hasta: "2026-01-01" }), /rango/);
  assert.throws(() => s.validateFilters({ status: "PENDIENTE" }, "reservas"), { status: 400 });
  assert.throws(() => s.validateFilters({ type: "invalido" }, "accesos"), { status: 400 });
});

test("HU10 conserva fecha calendario y genera hora GT incluso al cambiar de día UTC", () => {
  assert.equal(s.localTimestamp(new Date("2026-09-08T02:30:45Z")), "2026-09-07 20:30:45");
  assert.equal(s.display("fecha", "2026-09-07"), "07/09/2026");
  assert.equal(s.display("hora", "08:15:00"), "08:15:00");
  assert.equal(s.display("monto", "1234.5"), "1234.50");
});

test("HU10 consulta límites inclusivos y morosos con saldo después de abonos", async () => {
  await s.rows("morosos", { desde: "2026-01-01", hasta: "2026-09-07" }, new Date("2026-09-08T02:00:00Z"));
  const [sql, params] = query.mock.calls[0].arguments;
  assert.deepEqual(params, ["2026-09-07", "2026-01-01", "2026-09-07"]);
  assert.match(sql, /SUM\(monto_pagado\)/);
  assert.match(sql, /cu.monto > COALESCE\(pg.pagado, 0\)/);
  assert.match(sql, /reporte.fecha >= \?/);
  assert.match(sql, /reporte.fecha <= \?/);
  assert.doesNotMatch(sql, /CURDATE/);
});

test("HU10 accesos aplica búsqueda, unidad, placa, tipo y estado igual que la pantalla", async () => {
  await s.rows("accesos", { desde: "2026-09-01", hasta: "2026-09-07", search: "Ana", house: "A-1", plate: "P123", type: "VISITANTE", status: "APROBADO" });
  const [sql, params] = query.mock.calls[0].arguments;
  assert.deepEqual(params, ["2026-09-01", "2026-09-07", "%ana%", "%ana%", "%ana%", "%a-1%", "%p123%"]);
  assert.match(sql, /'VISITA', 'DELIVERY', 'VISITANTE'/);
  assert.match(sql, /SALIDA_REGISTRADA/);
  assert.match(sql, /TIME_FORMAT\(ra.hora_salida/);
});

test("HU10 exporta más de 500 filas y rechaza exceso sin truncamiento silencioso", async () => {
  query.mock.mockImplementation(async () => Array.from({ length: 501 }, () => ({ fecha: "2026-01-01" })));
  assert.equal((await s.rows("reservas")).length, 501);
  query.mock.mockImplementation(async () => Array(10001).fill({}));
  await assert.rejects(s.rows("reservas"), /Reduzca el período/);
});

test("HU10 Excel conserva columnas sin datos, montos numéricos y neutraliza fórmulas", async () => {
  const data = [{ fecha: "2026-09-07", residente: " =CMD()", unidad: "A-1", monto: "1234.50" }];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await s.excel("morosos", data, 1, {}, new Date("2026-09-08T02:00:00Z")));
  const sheet = workbook.worksheets[0];
  assert.match(sheet.getCell("A2").value, /2026-09-07 20:00:00.*America\/Guatemala/);
  assert.equal(sheet.getCell("A5").value, "Vencimiento");
  assert.equal(sheet.getCell("A6").value, "07/09/2026");
  assert.equal(sheet.getCell("B6").value, "' =CMD()");
  assert.equal(sheet.getCell("D6").value, 1234.5);
  const empty = new ExcelJS.Workbook();
  await empty.xlsx.load(await s.excel("reservas", [], 1));
  assert.equal(empty.worksheets[0].getCell("A5").value, "Fecha");
  assert.match(empty.worksheets[0].getCell("A6").value, /Sin datos/);
  for (const value of ["=CMD()", " +CMD()", "\t@CMD()", "-1"]) assert.equal(s.safe(value), `'${value}`);
});

test("HU10 PDF vacío y varias páginas con texto largo son documentos completos", async () => {
  for (const type of ["accesos", "reservas", "morosos", "sanciones"]) {
    const empty = await s.pdf(type, [], 1);
    assert.equal(empty.subarray(0, 4).toString(), "%PDF");
    assert.match(empty.toString("latin1"), /%%EOF/);
  }
  const pdf = await s.pdf("sanciones", Array.from({ length: 70 }, () => ({ fecha: "2026-09-07", motivo: "Texto extenso sin cortes. ".repeat(25), monto: 25 })), 1);
  assert.ok((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length > 1);
});

test("HU10 ruta valida autorización, errores y encabezados de ambas exportaciones", async () => {
  await request(app).get("/admin/reportes/exportar?reporte=accesos&formato=pdf").expect(401);
  await request(app).get("/admin/reportes/exportar?reporte=accesos&formato=pdf").set("x-user-role", "admin").expect(401);
  await request(app).get("/admin/reportes/exportar?reporte=reservas&formato=pdf&desde=2026-02-30").set("x-user-role", "admin").set("x-user-id", "1").expect(400);
  assert.equal(query.mock.callCount(), 0);
  for (const format of ["pdf", "xlsx"]) {
    const response = await request(app).get(`/admin/reportes/exportar?reporte=accesos&formato=${format}&vista=hoy&type=PROVEEDOR&status=PENDIENTE`).set("x-user-role", "admin").set("x-user-id", "1").expect(200);
    assert.match(response.headers["content-type"], format === "pdf" ? /application\/pdf/ : /spreadsheetml/);
    assert.match(response.headers["content-disposition"], new RegExp(`nexus-accesos-\\d{4}-\\d{2}-\\d{2}\\.${format}`));
    assert.equal(response.headers["cache-control"], "no-store");
    const [sql, params] = query.mock.calls.at(-1).arguments;
    assert.equal(params[0], params[1]);
    assert.match(sql, /PROVEEDOR/);
    assert.match(sql, /PENDIENTE_APROBACION/);
  }
});
