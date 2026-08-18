const mockConnection = { beginTransaction: jest.fn(), execute: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
jest.mock("../../database/mysql", () => ({ pool: { getConnection: jest.fn(async () => mockConnection) } }));
const { payObligation } = require("../simulatedPaymentsService");

const quota = { id_cuota: 3, id_casa: 8, monto: "100.00", recargo: "15.00", pagado: "0", concepto: "Mantenimiento", fecha_limite: "2026-08-31" };

beforeEach(() => { jest.clearAllMocks(); mockConnection.execute.mockReset(); });

function successfulPayment() {
  mockConnection.execute
    .mockResolvedValueOnce([[quota]])
    .mockResolvedValueOnce([{ insertId: 21 }])
    .mockResolvedValueOnce([{ insertId: 31 }]);
}

test("registra un pago residente con monto y recargo calculados en backend", async () => {
  successfulPayment();
  const result = await payObligation(4, "residente", 3);
  expect(result).toMatchObject({ id_pago: 21, total: 115, recargo: 15, estado: "APROBADA" });
  expect(mockConnection.execute.mock.calls[1][1]).toEqual([3, 115]);
  expect(mockConnection.execute.mock.calls[2][1]).toEqual([21, 4, 8, "residente", "Mantenimiento", 115]);
  expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

test("un inquilino autorizado reutiliza el mismo flujo", async () => {
  successfulPayment();
  const result = await payObligation(9, "inquilino", 3);
  expect(result.estado).toBe("APROBADA");
  expect(mockConnection.execute.mock.calls[0][0]).toContain("titular.autorizado = TRUE");
  expect(mockConnection.execute.mock.calls[2][1][3]).toBe("inquilino");
});

test("rechaza al inquilino sin relación autorizada", async () => {
  mockConnection.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ id_cuota: 3 }]]);
  await expect(payObligation(9, "inquilino", 3)).rejects.toMatchObject({ status: 403 });
});

test("rechaza un cargo inexistente", async () => {
  mockConnection.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
  await expect(payObligation(4, "residente", 99)).rejects.toMatchObject({ status: 404 });
  expect(mockConnection.rollback).toHaveBeenCalled();
});

test("rechaza un cargo de otra vivienda", async () => {
  mockConnection.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ id_cuota: 3 }]]);
  await expect(payObligation(4, "residente", 3)).rejects.toMatchObject({ status: 403 });
});

test("rechaza un cargo pagado y un segundo intento", async () => {
  mockConnection.execute.mockResolvedValue([[{ ...quota, pagado: "115.00" }]]);
  await expect(payObligation(4, "residente", 3)).rejects.toMatchObject({ status: 409 });
  await expect(payObligation(4, "residente", 3)).rejects.toMatchObject({ status: 409 });
});

test("un error de persistencia revierte la transacción sin confirmarla", async () => {
  mockConnection.execute.mockResolvedValueOnce([[quota]]).mockResolvedValueOnce([{ insertId: 21 }]).mockRejectedValueOnce(new Error("db"));
  await expect(payObligation(4, "residente", 3)).rejects.toThrow("db");
  expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
  expect(mockConnection.commit).not.toHaveBeenCalled();
});
