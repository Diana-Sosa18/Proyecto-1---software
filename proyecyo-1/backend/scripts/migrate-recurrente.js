const { pool, ensureSimulatedPaymentsSchema } = require("../src/database/mysql");
const { applyRecurrentePreparation, applyRecurrenteCheckoutMigration, applyRecurrenteConfirmationMigration, applyRecurrenteAttemptsMigration, applyRecurrenteRefundsMigration, applyRecurrenteIntentHistoryMigration, applyRecurrenteReviewPrecisionMigration } = require("../src/database/recurrenteMigration");
const { logger } = require("../src/utils/safeLogger");
async function main() {
  await ensureSimulatedPaymentsSchema();
  const connection = await pool.getConnection();
  try { await applyRecurrentePreparation(connection); await applyRecurrenteCheckoutMigration(connection); await applyRecurrenteConfirmationMigration(connection); await applyRecurrenteAttemptsMigration(connection); await applyRecurrenteRefundsMigration(connection); await applyRecurrenteIntentHistoryMigration(connection); await applyRecurrenteReviewPrecisionMigration(connection); }
  finally { connection.release(); }
  logger.info("Migracion aditiva de preparacion Recurrente aplicada.");
}
main().catch((error) => { logger.error("Fallo la migracion Recurrente.", error); process.exitCode = 1; })
  .finally(() => pool.end());
