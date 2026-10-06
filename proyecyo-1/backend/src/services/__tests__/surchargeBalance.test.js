const mockConnection = { beginTransaction: jest.fn(), execute: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
jest.mock("../../database/mysql", () => ({ query: jest.fn(), pool: { getConnection: jest.fn(async () => mockConnection) } }));
const { query } = require("../../database/mysql");
const { applySurcharges } = require("../financialRulesService");
test("generacion de recargos usa capital pendiente comun y conserva porcentaje configurado", async () => {
  query.mockResolvedValue([]);
  mockConnection.execute.mockResolvedValueOnce([[{ id_cuota: 1, id_casa: 2, monto: 100, saldo: 65 }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);
  // HU32: la fecha de revision/aplicacion es el dia de Guatemala (23:30 del 4 = 05:30 UTC del 5).
  const now = new Date("2026-10-05T05:30:00Z");
  expect(await applySurcharges(9, { now })).toEqual({ aplicados: 1, activo: true, fecha_revision: "2026-10-04" });
  expect(mockConnection.execute.mock.calls[0][0]).toContain("balance.capital_pendiente");
  expect(mockConnection.execute.mock.calls[0][0]).not.toContain("CURDATE()");
  expect(mockConnection.execute.mock.calls[0][1]).toEqual(["2026-01-01", 0, "2026-10-04"]);
  expect(mockConnection.execute.mock.calls[1][1]).toEqual([1, 2, "PORCENTAJE", 65, 3.25, "2026-10-04", 9]);
  expect(mockConnection.commit).toHaveBeenCalled();
});
