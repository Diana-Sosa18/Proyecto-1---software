const express = require("express");
const cors = require("cors");

const { env } = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const userTypesRoutes = require("./routes/userTypesRoutes");
const visitsRoutes = require("./routes/visitsRoutes");
const amenitiesReservationsRoutes = require("./routes/amenitiesReservationsRoutes");

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

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message =
      status === 413
        ? "La imagen seleccionada es demasiado grande. Prueba con una foto mas ligera."
        : error.message || "Error interno del servidor";

    if (status >= 500) {
      console.error(error);
    }

    res.status(status).json({ message });
  });

  return app;
}

module.exports = { createApp };
