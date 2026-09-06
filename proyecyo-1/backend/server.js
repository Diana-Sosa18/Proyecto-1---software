const { createApp } = require("./src/app");
const { env } = require("./src/config/env");
const {
  ensureVisitQrSchema,
  ensureQrValidationAttemptsSchema,
  ensureAmenityReservationsSchema,
  ensureNotificationsSchema,
  ensureTenantProvidersSchema,
  ensureAnnouncementsSchema,
  ensureSpecialAccessSchema,
  ensureSprintUserStoriesSchema,
  ensureRestoreHistorySchema,
  ensureFinancialRulesSchema,
  ensureSanctionsSchema,
  ensureTenantAccountSeed,
  ensureConfigurationSchema,
  ensureAutomaticBackupsSchema,
  ensureRemindersSchema,
  ensureDemoRequestsSchema,
  query,
} = require("./src/database/mysql");
const { startScheduler } = require("./src/services/automaticBackupsService");

const DB_READY_RETRIES = 30;
const DB_READY_DELAY_MS = 2000;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= DB_READY_RETRIES; attempt += 1) {
    try {
      await query("SELECT 1");
      return;
    } catch (error) {
      const isLastAttempt = attempt === DB_READY_RETRIES;

      if (isLastAttempt) {
        throw error;
      }

      console.log(
        `Base de datos no disponible todavia (${attempt}/${DB_READY_RETRIES}). Reintentando...`,
      );
      await delay(DB_READY_DELAY_MS);
    }
  }
}

async function startServer() {
  await waitForDatabase();
  await ensureVisitQrSchema();
  await ensureQrValidationAttemptsSchema();
  await ensureAmenityReservationsSchema();
  await ensureNotificationsSchema();
  await ensureTenantProvidersSchema();
  await ensureAnnouncementsSchema();
  await ensureSpecialAccessSchema();
  await ensureSprintUserStoriesSchema();
  await ensureRestoreHistorySchema();
  await ensureFinancialRulesSchema();
  await ensureSanctionsSchema();
  await ensureTenantAccountSeed();
  await ensureConfigurationSchema();
  await ensureAutomaticBackupsSchema();
  await ensureRemindersSchema();
  await ensureDemoRequestsSchema();
  startScheduler();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error("No fue posible iniciar el servidor.", error);
  process.exit(1);
});
