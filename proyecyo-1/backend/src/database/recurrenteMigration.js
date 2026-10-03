const fs = require("node:fs");
const path = require("node:path");
const MIGRATION_PATH = path.resolve(__dirname, "../../sql/migrations/001_recurrente_preparation.sql");
const CHECKOUT_MIGRATION_PATH = path.resolve(__dirname, "../../sql/migrations/002_recurrente_checkout.sql");
const CONFIRMATION_MIGRATION_PATH = path.resolve(__dirname, "../../sql/migrations/003_recurrente_confirmation.sql");
function migrationStatements(file = MIGRATION_PATH) {
  // This migration contains plain SQL, without procedures or semicolons in literals.
  return fs.readFileSync(file, "utf8").replace(/^\s*--.*$/gm, "")
    .split(";").map((statement) => statement.trim()).filter(Boolean);
}
async function applyMigration(connection, file, lockName) {
  // DDL commits implicitly in MySQL; each operation is independently re-runnable.
  // Use a dedicated connection and a DB lock to avoid concurrent startup backfills.
  const [locks] = await connection.execute(`SELECT GET_LOCK('${lockName}', 30) AS acquired`);
  if (Number(locks[0]?.acquired) !== 1) throw new Error("No se pudo adquirir el bloqueo de migracion.");
  try {
    for (const statement of migrationStatements(file)) await connection.query(statement);
  } finally {
    await connection.execute(`SELECT RELEASE_LOCK('${lockName}')`);
  }
}
const applyRecurrentePreparation = (connection) => applyMigration(connection, MIGRATION_PATH, "nexus_recurrente_phase0");
const applyRecurrenteCheckoutMigration = (connection) => applyMigration(connection, CHECKOUT_MIGRATION_PATH, "nexus_recurrente_hu13");
const applyRecurrenteConfirmationMigration = (connection) => applyMigration(connection, CONFIRMATION_MIGRATION_PATH, "nexus_recurrente_hu14");
module.exports = { applyRecurrentePreparation, applyRecurrenteCheckoutMigration, applyRecurrenteConfirmationMigration,
  migrationStatements, MIGRATION_PATH, CHECKOUT_MIGRATION_PATH, CONFIRMATION_MIGRATION_PATH };
