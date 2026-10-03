const mockConnection = { beginTransaction: jest.fn(), execute: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
jest.mock("../../database/mysql", () => ({ query: jest.fn(), pool: { getConnection: jest.fn(async () => mockConnection) } }));
const { query } = require("../../database/mysql");
const { applySurcharges } = require("../financialRulesService");
test("generacion de recargos usa capital pendiente comun y conserva porcentaje configurado", async () => {
  query.mockResolvedValue([]);
  mockConnection.execute.mockResolvedValueOnce([[{ id_cuota: 1, id_casa: 2, monto: 100, saldo: 65 }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);
  expect(await applySurcharges(9)).toEqual({ aplicados: 1 });
  expect(mockConnection.execute.mock.calls[0][0]).toContain("balance.capital_pendiente");
  expect(mockConnection.execute.mock.calls[1][1]).toEqual([1, 2, "PORCENTAJE", 65, 3.25, 9]);
  expect(mockConnection.commit).toHaveBeenCalled();
});
