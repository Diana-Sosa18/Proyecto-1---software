const express = require("express");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const userTypesRoutes = require("./routes/userTypesRoutes");

const app = express();

app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/user-types", userTypesRoutes);

module.exports = app;
