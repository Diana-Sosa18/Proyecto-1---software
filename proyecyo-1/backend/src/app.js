const express = require("express");
const cors = require("cors");

const { env } = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const userTypesRoutes = require("./routes/userTypesRoutes");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(authRoutes);
  app.use(usersRoutes);
  app.use(userTypesRoutes);

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message = error.message || "Error interno del servidor";

    if (status >= 500) {
      console.error(error);
    }

    res.status(status).json({ message });
  });

  return app;
}

module.exports = { createApp };
