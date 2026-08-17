const mockConnection = { beginTransaction: jest.fn(), execute: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
jest.mock("../../database/mysql", () => ({ query: jest.fn(), pool: { getConnection: jest.fn(async () => mockConnection) } }));
const { query } = require("../../database/mysql");
const { sendPaymentReminders } = require("../adminRemindersService");

function quota(id_usuario, id_cuota = 1) { return { id_usuario, id_cuota, id_casa: 2, saldo: 100,
  servicio: "Alquiler", fecha_limite: "2099-01-02", dias_para_vencer: 1 }; }

beforeEach(() => { jest.clearAllMocks(); mockConnection.execute.mockReset(); });

async function prepare(quotas, existing = []) {
  query.mockResolvedValueOnce([{ clave: "recordatorios_activo", valor: "true" }, { clave: "recordatorios_dias_antes", valor: "3" }])
    .mockResolvedValueOnce(quotas);
  mockConnection.execute.mockImplementation(async (sql) => {
    if (sql.includes("SELECT id_recordatorio")) return [existing];
    if (sql.includes("INSERT INTO NOTIFICACION")) return [{ insertId: 44 }];
    return [{}];
  });
  return sendPaymentReminders(null);
}

test("genera recordatorios separados para residente e inquilino correctos", async () => {
  const result = await prepare([quota(10), quota(20)]);
  expect(result.enviados).toBe(2);
  const notificationCalls = mockConnection.execute.mock.calls.filter(([sql]) => sql.includes("INSERT INTO NOTIFICACION"));
  expect(notificationCalls.map((call) => call[1][0])).toEqual([10, 20]);
});

test("no duplica cuota, usuario, tipo y fecha", async () => {
  const result = await prepare([quota(10)], [{ id_recordatorio: 1 }]);
  expect(result.enviados).toBe(0);
  expect(mockConnection.execute.mock.calls[0][1].slice(0, 2)).toEqual([1, 10]);
});

test("consulta solo saldos impagos dentro del rango configurado", async () => {
  const result = await prepare([]);
  expect(result.enviados).toBe(0);
  const sql = query.mock.calls[1][0];
  expect(sql).toContain("cu.monto - COALESCE(pagos.total_pagado, 0) > 0");
  expect(sql).toContain("DATE_ADD(?, INTERVAL ? DAY)");
  expect(sql).toContain("i.autorizado = TRUE");
  expect(sql).toContain("activo = TRUE");
});
