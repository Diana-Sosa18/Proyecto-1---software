const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSessionSecret() {
  const value = String(process.env.SESSION_SECRET || "").trim();
  if (value) return value;
  if ((process.env.NODE_ENV || "development") === "production") {
    throw new Error("SESSION_SECRET es obligatorio en produccion.");
  }
  return "nexus-local-development-secret-change-me";
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: getNumber(process.env.PORT, 3000),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: getNumber(process.env.DB_PORT, 3306),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "nexus_residencial",
  DB_CONNECTION_LIMIT: getNumber(process.env.DB_CONNECTION_LIMIT, 10),
  USE_BCRYPT: process.env.USE_BCRYPT === "true",
  SESSION_SECRET: getSessionSecret(),
};

module.exports = { env };
