jest.mock("../../database/mysql", () => ({ query: jest.fn() }));
const { query } = require("../../database/mysql");
const { listRecentPayments } = require("../adminPaymentsService");

beforeEach(() => query.mockReset());

test("devuelve pagos HU11/HU12 ordenados y mapeados", async () => {
  query.mockResolvedValue([{ id_transaccion: "2", id_pago: "9", id_usuario: "7", usuario: "Ana", rol: "inquilino", unidad: "A-2", concepto: "Alquiler", monto: "500", fecha: "2026-08-20", hora: "12:00:00", estado: "APROBADA" }]);
  const result = await listRecentPayments();
  expect(result[0]).toMatchObject({ id_transaccion: 2, monto: 500, rol: "inquilino" });
  expect(query.mock.calls[0][0]).toContain("ORDER BY t.creado_en DESC, t.id_transaccion DESC");
  expect(query.mock.calls[0][0]).toContain("TRANSACCION_SIMULADA");
});

test("combina filtros parametrizados de usuario, unidad, fecha, estado y rol", async () => {
  query.mockResolvedValue([]);
  await listRecentPayments({ usuario: "Ana", unidad: "A-2", desde: "2026-08-01", hasta: "2026-08-31", estado: "APROBADA", rol: "INQUILINO" });
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain("LOWER(u.nombre) LIKE ?"); expect(sql).toContain("DATE(t.creado_en) >= ?");
  expect(params).toEqual(["%ana%", "%a-2%", "INQUILINO", "APROBADA", "2026-08-01", "2026-08-31"]);
});

test("rechaza filtros inválidos", async () => {
  await expect(listRecentPayments({ estado: "BORRADA" })).rejects.toMatchObject({ status: 400 });
  await expect(listRecentPayments({ desde: "2026-09-01", hasta: "2026-08-01" })).rejects.toMatchObject({ status: 400 });
});
