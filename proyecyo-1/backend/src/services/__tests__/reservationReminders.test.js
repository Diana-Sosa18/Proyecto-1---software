const mockConnection = {
  beginTransaction: jest.fn(), execute: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
};
jest.mock("../../database/mysql", () => ({
  query: jest.fn(),
  pool: { getConnection: jest.fn(async () => mockConnection) },
}));
const { query } = require("../../database/mysql");
const { sendReservationReminders } = require("../adminRemindersService");

const upcoming = {
  id_usuario: 17,
  id_amenidad: 4,
  fecha: "2026-08-20",
  hora_inicio: "18:00",
  amenidad: "Salón social",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConnection.execute.mockImplementation(async (sql) => {
    if (sql.includes("SELECT id_recordatorio")) return [[]];
    if (sql.includes("INSERT INTO NOTIFICACION")) return [{ insertId: 55 }];
    return [{}];
  });
});

test("una reserva próxima genera un recordatorio para su usuario", async () => {
  query.mockResolvedValue([upcoming]);
  await expect(sendReservationReminders()).resolves.toMatchObject({ enviados: 1 });
  const notification = mockConnection.execute.mock.calls.find(([sql]) => sql.includes("INSERT INTO NOTIFICACION"));
  expect(notification[1][0]).toBe(17);
  expect(notification[1][1]).toBe("RECORDATORIO_RESERVA");
  expect(mockConnection.commit).toHaveBeenCalledTimes(1);
});

test("la consulta excluye reservas lejanas, canceladas, iniciadas y finalizadas", async () => {
  query.mockResolvedValue([]);
  await expect(sendReservationReminders()).resolves.toMatchObject({ enviados: 0 });
  const sql = query.mock.calls[0][0];
  expect(sql).toContain("NOT IN ('CANCELADA', 'FINALIZADA')");
  expect(sql).toContain("TIMESTAMP(r.fecha, r.hora_inicio) > NOW()");
  expect(sql).toContain("DATE_ADD(NOW(), INTERVAL ? MINUTE)");
  expect(query.mock.calls[0][1]).toEqual([60]);
});

test("una segunda ejecución no duplica el recordatorio", async () => {
  query.mockResolvedValue([upcoming]);
  mockConnection.execute.mockImplementation(async (sql) => {
    if (sql.includes("SELECT id_recordatorio")) return [[{ id_recordatorio: 1 }]];
    return [{}];
  });
  await expect(sendReservationReminders()).resolves.toMatchObject({ enviados: 0 });
  expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
  expect(mockConnection.commit).not.toHaveBeenCalled();
});
