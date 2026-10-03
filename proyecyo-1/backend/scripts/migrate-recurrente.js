const { pool, ensureSimulatedPaymentsSchema } = require("../src/database/mysql");
const { applyRecurrentePreparation, applyRecurrenteCheckoutMigration } = require("../src/database/recurrenteMigration");
const { logger } = require("../src/utils/safeLogger");
async function main() {
  await ensureSimulatedPaymentsSchema();
  const connection = await pool.getConnection();
  try { await applyRecurrentePreparation(connection); await applyRecurrenteCheckoutMigration(connection); }
  finally { connection.release(); }
  logger.info("Migracion aditiva de preparacion Recurrente aplicada.");
}
main().catch((error) => { logger.error("Fallo la migracion Recurrente.", error); process.exitCode = 1; })
  .finally(() => pool.end());
