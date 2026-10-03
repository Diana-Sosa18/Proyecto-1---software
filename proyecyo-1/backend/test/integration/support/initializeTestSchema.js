const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { connect } = require("./isolatedMysql");
async function initializeTestSchema() {
  const connection = await connect(undefined, true);
  try {
    const [tables] = await connection.query("SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name<>'NEXUS_TEST_RUN_OWNER'");
    if (Number(tables[0].count)) return; // Preserve fixtures on subsequent executions.
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../sql/init.sql"), "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/^[ \t]*(?:CREATE DATABASE IF NOT EXISTS nexus_residencial|USE nexus_residencial|DROP TABLE IF EXISTS [A-Za-z0-9_]+);[ \t]*$/gm, "");
    assert(!/^[ \t]*(?:DROP|TRUNCATE|DELETE|USE|CREATE DATABASE)\b/im.test(sql), "Unsafe test fixture initialization");
    await connection.query(sql);
  } finally { await connection.end(); }
}
module.exports = { initializeTestSchema };
