// Independent local/Railway cron. Never imports server.js, applies migrations,
// seeds data or initializes a provider client. Use a previously migrated DB.
async function main() {
  const { pool } = require('../src/database/mysql');
  try {
    const { createFinancialNotificationsService } = require('../src/services/financialNotificationsService');
    const result = await createFinancialNotificationsService().run();
    console.info(JSON.stringify(result)); // Counts/date only, no config or error payload.
    if (result.errores) process.exitCode = 1;
  } catch {
    console.error('No se pudo completar el job de notificaciones financieras. Las entregas pendientes se conservan.');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
if (require.main === module) void main();
module.exports = { main };
