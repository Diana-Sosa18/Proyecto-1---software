const express = require("express");
const cors = require("cors");

const { env } = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const userTypesRoutes = require("./routes/userTypesRoutes");
const visitsRoutes = require("./routes/visitsRoutes");
const amenitiesReservationsRoutes = require("./routes/amenitiesReservationsRoutes");
const adminAccessesRoutes = require("./routes/adminAccessesRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const tenantProvidersRoutes = require("./routes/tenantProvidersRoutes");
const adminProvidersRoutes = require("./routes/adminProvidersRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const specialAccessesRoutes = require("./routes/specialAccessesRoutes");
const sprintStoriesRoutes = require("./routes/sprintStoriesRoutes");
const adminPaymentsRoutes = require("./routes/adminPaymentsRoutes");
const adminAuthorizedUsersRoutes = require("./routes/adminAuthorizedUsersRoutes");
const restoresRoutes = require("./routes/restoresRoutes");
const adminSanctionsRoutes = require("./routes/adminSanctionsRoutes");
const configurationRoutes = require("./routes/configurationRoutes");
const financialRulesRoutes = require("./routes/financialRulesRoutes");
const sanctionHistoryRoutes = require("./routes/sanctionHistoryRoutes");
const residentMonthlySummaryRoutes = require("./routes/residentMonthlySummaryRoutes");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(authRoutes);
  app.use(usersRoutes);
  app.use(userTypesRoutes);
  app.use(visitsRoutes);
  app.use(amenitiesReservationsRoutes);
  app.use(adminAccessesRoutes);
  app.use(notificationsRoutes);
  app.use(tenantProvidersRoutes);
  app.use(adminProvidersRoutes);
  app.use(announcementsRoutes);
  app.use(specialAccessesRoutes);
  app.use(sprintStoriesRoutes);
  app.use(adminPaymentsRoutes);
  app.use(adminAuthorizedUsersRoutes);
  app.use(restoresRoutes);
  app.use(adminSanctionsRoutes);
  app.use(configurationRoutes);
  app.use(financialRulesRoutes);
  app.use(sanctionHistoryRoutes);
  app.use(residentMonthlySummaryRoutes);

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message =
      status === 413
        ? "La imagen seleccionada es demasiado grande. Prueba con una foto mas ligera."
        : error.message || "Error interno del servidor";

    if (status >= 500) {
      console.error(error);
    }

    res.status(status).json({
      message,
      ...(error.code ? { code: error.code } : {}),
    });
  });

  return app;
}

module.exports = { createApp };
