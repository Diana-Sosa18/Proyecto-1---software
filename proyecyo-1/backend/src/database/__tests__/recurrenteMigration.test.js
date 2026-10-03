const fs = require("node:fs");
const { applyRecurrentePreparation, applyRecurrenteConfirmationMigration, migrationStatements, MIGRATION_PATH, CONFIRMATION_MIGRATION_PATH } = require("../recurrenteMigration");
test("migracion aditiva clasifica historial y prepara cinco tablas sin datos de tarjeta", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|REPLACE|UPDATE)\s+(TABLE|FROM|PAGO)\b/i);
  expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(5);
  expect(sql).toContain("WHERE o.id_pago IS NULL");
  expect(sql).toContain("uq_evento_svix_ambiente (ambiente, svix_id)");
  expect(sql).toContain("REFERENCES PAGO_ORIGEN(id_pago, ambiente, id_cuota)");
  expect(sql).toContain("REFERENCES CUOTA(id_cuota, id_casa)");
  expect(sql).toContain("REFERENCES CHECKOUT_RECURRENTE(id_checkout, ambiente, id_cuota, id_usuario, id_casa, moneda)");
  expect(sql).not.toMatch(/\b(pan|cvc|cvv|card_number|payload|raw_body)\s+(VARCHAR|TEXT|JSON|BLOB)/i);
});
test("aplica sentencias secuenciales bajo bloqueo y puede repetirse", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[{ acquired: 1 }]]), query: jest.fn().mockResolvedValue([]) };
  await applyRecurrentePreparation(connection);
  await applyRecurrentePreparation(connection);
  expect(connection.query).toHaveBeenCalledTimes(migrationStatements().length * 2);
  expect(connection.execute.mock.calls[0][0]).toContain("GET_LOCK");
  expect(connection.execute.mock.calls.at(-1)[0]).toContain("RELEASE_LOCK");
});
test("libera bloqueo tras error para poder reintentar la migracion", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[{ acquired: 1 }]]), query: jest.fn().mockRejectedValue(new Error("DDL failure")) };
  await expect(applyRecurrentePreparation(connection)).rejects.toThrow("DDL failure");
  expect(connection.execute.mock.calls.at(-1)[0]).toContain("RELEASE_LOCK");
});
test("no modifica esquema sin adquirir bloqueo", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[{ acquired: 0 }]]), query: jest.fn() };
  await expect(applyRecurrentePreparation(connection)).rejects.toThrow(/bloqueo/);
  expect(connection.query).not.toHaveBeenCalled();
});
test("003 preserva tablas/columnas y libera bloqueo tras fallo DDL", async () => {
  const sql = fs.readFileSync(CONFIRMATION_MIGRATION_PATH, "utf8");
  expect(sql).not.toMatch(/\bDROP\s+(TABLE|DATABASE|COLUMN)\b|\bTRUNCATE\b|\bDELETE\s+FROM/i);
  const connection = { execute: jest.fn().mockResolvedValue([[{ acquired: 1 }]]), query: jest.fn().mockRejectedValue(new Error("DDL failure")) };
  await expect(applyRecurrenteConfirmationMigration(connection)).rejects.toThrow("DDL failure");
  expect(connection.execute.mock.calls.at(-1)[0]).toContain("RELEASE_LOCK");
});

test("004 aditiva y repetible agrega trazabilidad sin modificar filas", async () => {
  const { ATTEMPTS_MIGRATION_PATH, applyRecurrenteAttemptsMigration } = require("../recurrenteMigration");
  const sql = fs.readFileSync(ATTEMPTS_MIGRATION_PATH, "utf8");
  expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b/i);
  expect(sql).toContain("chk_transaccion_fallo_hu15"); expect(sql).toContain("fk_evento_checkout_hu15");
  const c = { execute: jest.fn().mockResolvedValue([[{ acquired: 1 }]]), query: jest.fn().mockResolvedValue([]) };
  await applyRecurrenteAttemptsMigration(c); await applyRecurrenteAttemptsMigration(c);
  expect(c.query).toHaveBeenCalledTimes(migrationStatements(ATTEMPTS_MIGRATION_PATH).length * 2);
  expect(c.execute.mock.calls.at(-1)[0]).toContain("RELEASE_LOCK");
});
