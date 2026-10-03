const { configureTestEnvironment } = require("../test/integration/support/isolatedMysql");
require("../test/integration/support/suiteIsolation").assertOwnedSuiteDatabase();
configureTestEnvironment(); // No defaults and no connection to the normal database.
const { initializeTestSchema } = require("../test/integration/support/initializeTestSchema");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const db = require("../src/database/mysql");
const { applyRecurrentePreparation, applyRecurrenteCheckoutMigration, applyRecurrenteConfirmationMigration, applyRecurrenteAttemptsMigration } = require("../src/database/recurrenteMigration");
const { createApp } = require("../src/app");
const { logger } = require("../src/utils/safeLogger");
async function main() {
  await initializeTestSchema();
  for (const [name, ensure] of Object.entries(db)) if (name.startsWith("ensure")) await ensure();
  const connection = await db.pool.getConnection();
  try { await applyRecurrentePreparation(connection); await applyRecurrenteCheckoutMigration(connection); await applyRecurrenteConfirmationMigration(connection); await applyRecurrenteAttemptsMigration(connection); } finally { connection.release(); }
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  try {
    const files = fs.readdirSync(path.resolve(__dirname, "../test"))
      .filter((name) => name.endsWith(".functional.test.js")).map((name) => path.resolve(__dirname, "../test", name));
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--test", ...files], { windowsHide: true, stdio: "inherit",
        env: { ...process.env, RUN_FUNCTIONAL_TESTS: "1", API_URL: `http://127.0.0.1:${server.address().port}` } });
      child.once("error", reject); child.once("exit", resolve);
    });
    process.exitCode = code || 0;
  } finally { await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { logger.error("Fallaron pruebas funcionales aisladas.", error); process.exitCode = 1; })
  .finally(() => db.pool.end());
