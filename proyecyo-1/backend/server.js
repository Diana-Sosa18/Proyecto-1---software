const { createApp } = require("./src/app");
const { env } = require("./src/config/env");
const {
  ensureVisitQrSchema,
  ensureAmenityReservationsSchema,
  ensureNotificationsSchema,
} = require("./src/database/mysql");

async function startServer() {
  await ensureVisitQrSchema();
  await ensureAmenityReservationsSchema();
  await ensureNotificationsSchema();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error("No fue posible iniciar el servidor.", error);
  process.exit(1);
});