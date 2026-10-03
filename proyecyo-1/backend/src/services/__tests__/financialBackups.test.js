const mockConnection = { query: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), beginTransaction: jest.fn() };
jest.mock("../../database/mysql", () => ({ query: jest.fn(), pool: { getConnection: jest.fn(async () => mockConnection) } }));
const { query } = require("../../database/mysql");
const { BACKUP_TABLES, FINANCIAL_TABLES } = require("../../database/backupTables");
const { generateSql } = require("../automaticBackupsService");
const { validateBackupPayload, restoreBackup, verifyRestoredReferences } = require("../restoresService");
beforeEach(() => {
  jest.clearAllMocks(); mockConnection.query.mockReset(); query.mockReset();
  mockConnection.query.mockResolvedValue([[]]); query.mockResolvedValue({ insertId: 1 });
});
test("mantiene las tablas anteriores y permite restaurar todas las nuevas financieras", () => {
  for (const table of ["TIPO_USUARIO", "USUARIO", "CASA", "RESIDENTE", "INQUILINO", "AMENIDAD", "CUOTA", "PAGO", "RESERVA", "VISITANTE", "ACCESO", "REGISTRO_ACCESO", "CONFIGURACION", ...FINANCIAL_TABLES]) {
    expect(BACKUP_TABLES).toContain(table);
    expect(validateBackupPayload({ filename: "test.sql", content: `INSERT INTO ${table} (fixture) VALUES (1);` }).tables).toContain(table);
  }
});
test("genera respaldo de las nuevas tablas desde una sola instantanea y conserva fechas", async () => {
  mockConnection.query.mockImplementation(async (input) => {
    if (typeof input === "object" && input.sql.startsWith("SELECT *")) return [[{ id: 1, fecha: "2026-10-01 12:00:00.123456" }]];
    return [[]];
  });
  const sql = await generateSql();
  for (const table of FINANCIAL_TABLES) expect(sql).toContain(`INSERT INTO \`${table}\``);
  expect(sql).toContain("2026-10-01 12:00:00.123456");
  expect(mockConnection.query.mock.calls[1][0]).toContain("WITH CONSISTENT SNAPSHOT, READ ONLY");
  expect(mockConnection.query.mock.calls[2][0].dateStrings).toBe(true);
  expect(mockConnection.commit).toHaveBeenCalledTimes(1);
  expect(mockConnection.release).toHaveBeenCalledTimes(1);
});
test.each(["PAGO_ORIGEN", "CUOTA", "PAGO", "RECARGO_APLICADO", "TRANSACCION_SIMULADA"])("tabla financiera %s ausente impide un respaldo silenciosamente incompleto", async (table) => {
  mockConnection.query.mockImplementation(async (input) => {
    if (input.sql === `SELECT * FROM \`${table}\``) throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
    return [[]];
  });
  await expect(generateSql()).rejects.toThrow("missing");
  expect(mockConnection.rollback).toHaveBeenCalled(); expect(mockConnection.commit).not.toHaveBeenCalled();
});
test("conserva compatibilidad con tabla antigua opcional ausente", async () => {
  mockConnection.query.mockImplementation(async (input) => {
    if (input.sql?.includes("AMENIDAD")) throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
    return [[]];
  });
  await expect(generateSql()).resolves.toContain("NexusResidencial");
});
test("validacion FK compuesta comprueba todas las columnas antes del commit", async () => {
  mockConnection.query.mockResolvedValueOnce([[
    { TABLE_NAME: "PAGO_ORIGEN", CONSTRAINT_NAME: "test", COLUMN_NAME: "id_pago", REFERENCED_TABLE_NAME: "PAGO", REFERENCED_COLUMN_NAME: "id_pago" },
    { TABLE_NAME: "PAGO_ORIGEN", CONSTRAINT_NAME: "test", COLUMN_NAME: "id_cuota", REFERENCED_TABLE_NAME: "PAGO", REFERENCED_COLUMN_NAME: "id_cuota" },
  ]]).mockResolvedValueOnce([[]]);
  await verifyRestoredReferences(mockConnection, ["PAGO"]);
  const sql = mockConnection.query.mock.calls[1][0];
  expect(sql).toContain("parent.`id_pago` = child.`id_pago`"); expect(sql).toContain("parent.`id_cuota` = child.`id_cuota`");
  expect(sql).toContain("child.`id_pago` IS NOT NULL AND child.`id_cuota` IS NOT NULL");
});
test("referencias huerfanas revierten la restauracion y restablecen FK", async () => {
  mockConnection.query.mockImplementation(async (sql) => {
    if (sql.includes("information_schema.KEY_COLUMN_USAGE")) return [[{ TABLE_NAME: "PAGO_ORIGEN", CONSTRAINT_NAME: "test", COLUMN_NAME: "id_pago", REFERENCED_TABLE_NAME: "PAGO", REFERENCED_COLUMN_NAME: "id_pago" }]];
    if (sql.includes("NOT EXISTS")) return [[{ orphan: 1 }]];
    return [[]];
  });
  await expect(restoreBackup(1, { filename: "test.sql", content: "INSERT INTO PAGO_ORIGEN (id_pago) VALUES (7);" })).rejects.toMatchObject({ status: 400 });
  expect(mockConnection.rollback).toHaveBeenCalled(); expect(mockConnection.commit).not.toHaveBeenCalled();
  expect(mockConnection.query.mock.calls.some(([sql]) => sql === "SET FOREIGN_KEY_CHECKS = 1")).toBe(true);
});
test("rechaza un destino calificado que salga de la base seleccionada", () => {
  expect(() => validateBackupPayload({ filename: "test.sql", content: "INSERT INTO USUARIO.other_table VALUES(1);" })).toThrow(/autorizadas/);
});
