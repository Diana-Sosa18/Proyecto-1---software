const { isolatedConfig } = require("./isolatedMysql");
isolatedConfig();
const { confirmFixture } = require("./financialFixtures");
process.send({ ready: true });
process.once("message", async ({ transactionId }) => {
  try { process.send({ result: await confirmFixture(transactionId) }); }
  catch (error) { process.send({ error: { code: error.code, message: error.message } }); process.exitCode = 1; }
  finally { process.disconnect(); }
});
