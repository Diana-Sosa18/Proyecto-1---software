const { configureTestEnvironment } = require("./isolatedMysql");
configureTestEnvironment();
const { pool } = require("../../../src/database/mysql");
const { restoreBackup } = require("../../../src/services/restoresService");
process.send({ ready: true });
process.once("message", async ({ content }) => {
  try { process.send({ result: await restoreBackup(1, { filename: "phase0-test.sql", content }) }); }
  catch (error) { process.send({ error: { code: error.code, message: error.message } }); process.exitCode = 1; }
  finally { await pool.end(); process.disconnect(); }
});
