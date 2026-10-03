// Opt-in manual harness. Never import the normal server or start its schedulers.
const path = require("node:path");
const { isolatedConfig } = require("../test/integration/support/isolatedMysql");

function configureManualEnvironment() {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
  const config = isolatedConfig(); // Mandatory isolated name/port, no normal database fallback.
  Object.assign(process.env, { NODE_ENV: "development", DB_HOST: config.host, DB_PORT: String(config.port),
    DB_USER: config.user, DB_PASSWORD: config.password, DB_NAME: config.database, USE_BCRYPT: "false",
    SESSION_SECRET: "hu13-isolated-manual-session-only", PORT: "3100", FRONTEND_ORIGIN: "http://127.0.0.1:5174",
    EMAIL_API_URL: "", EMAIL_API_KEY: "" });
  return config;
}

async function seedManualQuota(pool) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [owners] = await c.execute(`SELECT c.id_casa FROM CASA c
      INNER JOIN RESIDENTE r ON r.id_residente=c.id_residente
      INNER JOIN USUARIO u ON u.id_usuario=r.id_usuario
      WHERE u.correo='residente@test.com' AND u.activo=TRUE ORDER BY c.id_casa LIMIT 1 FOR UPDATE`);
    if (!owners[0]) throw new Error("Falta residente TEST en la base aislada.");
    const name = "HU13 Sandbox Q5 TEST";
    const [services] = await c.execute("SELECT id_servicio FROM SERVICIO WHERE nombre=? ORDER BY id_servicio LIMIT 1", [name]);
    let serviceId = services[0]?.id_servicio;
    if (!serviceId) serviceId = (await c.execute("INSERT INTO SERVICIO(nombre,tipo_servicio,descripcion) VALUES(?,'General','Fixture manual aislado HU13')", [name]))[0].insertId;
    const [quotas] = await c.execute("SELECT id_cuota FROM CUOTA WHERE id_servicio=? AND id_casa=? ORDER BY id_cuota LIMIT 1", [serviceId, owners[0].id_casa]);
    const quotaId = quotas[0]?.id_cuota || (await c.execute("INSERT INTO CUOTA(id_servicio,id_casa,monto,fecha_limite) VALUES(?,?,5.00,DATE_ADD(CURDATE(),INTERVAL 7 DAY))", [serviceId, owners[0].id_casa]))[0].insertId;
    await c.commit(); return quotaId;
  } catch (error) { await c.rollback(); throw error; }
  finally { c.release(); }
}

async function main() {
  const config = configureManualEnvironment();
  require("../src/config/recurrenteCheckout").getCheckoutConfig(); // Local validation only, no /test request yet.
  const db = require("../src/database/mysql");
  try {
    await require("../test/integration/support/initializeTestSchema").initializeTestSchema();
    for (const [name, ensure] of Object.entries(db)) if (name.startsWith("ensure")) await ensure();
    const c = await db.pool.getConnection();
    try {
      const [current] = await c.query("SELECT DATABASE() name");
      if (current[0].name !== config.database) throw new Error("Base inesperada.");
      const migrations = require("../src/database/recurrenteMigration");
      await migrations.applyRecurrentePreparation(c); await migrations.applyRecurrenteCheckoutMigration(c);
      await migrations.applyRecurrenteConfirmationMigration(c);
    } finally { c.release(); }
    const quotaId = await seedManualQuota(db.pool);
    const server = require("../src/app").createApp().listen(3100, "127.0.0.1");
    await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    console.info(`HU13 manual: http://127.0.0.1:3100 | base aislada ${config.database} | cuota TEST ${quotaId}`);
    console.info("Frontend: http://127.0.0.1:5174 | residente@test.com | clave de fixture 1234 | servicio HU13 Sandbox Q5 TEST");
    const close = () => server.close(() => db.pool.end().then(() => process.exit(0)));
    process.once("SIGINT", close); process.once("SIGTERM", close);
  } catch (error) { await db.pool.end(); throw error; }
}
if (require.main === module) main().catch(() => {
  // Do not print config, headers, provider payloads, causes or arbitrary error messages.
  console.error("No se pudo iniciar HU13 aislado. Revisa las variables locales, la base TEST y el puerto 3100.");
  process.exitCode = 1;
});
module.exports = { configureManualEnvironment, seedManualQuota };
