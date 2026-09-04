const { query } = require("../database/mysql");
const { env } = require("../config/env");

async function comparePassword(plainPassword, storedPassword) {
  if (typeof storedPassword === "string" && storedPassword.startsWith("$2")) {
    const bcrypt = require("bcryptjs");
    return bcrypt.compare(plainPassword, storedPassword);
  }

  if (!env.USE_BCRYPT) {
    return plainPassword === storedPassword;
  }

  const bcrypt = require("bcryptjs");
  return bcrypt.compare(plainPassword, storedPassword);
}

async function loginUser({ email, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();

  if (!normalizedEmail || !normalizedPassword) {
    const error = new Error("Correo y contrasena son obligatorios.");
    error.status = 400;
    throw error;
  }

  const rows = await query(
    `
      SELECT
        u.id_usuario AS id,
        u.correo AS email,
        tu.nombre AS role,
        u.password AS password,
        u.activo AS activo
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      WHERE LOWER(u.correo) = ?
      LIMIT 1
    `,
    [normalizedEmail],
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("Credenciales incorrectas.");
    error.status = 401;
    throw error;
  }

  const passwordMatches = await comparePassword(normalizedPassword, user.password);

  if (!passwordMatches) {
    const error = new Error("Credenciales incorrectas.");
    error.status = 401;
    throw error;
  }

  if (Number(user.activo) === 0) {
    const error = new Error("El usuario esta inactivo.");
    error.status = 403;
    throw error;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

// Devuelve el rol y estado actuales del usuario desde la base de datos.
// Permite al frontend refrescar los permisos sin depender de lo guardado al iniciar sesion.
async function getCurrentSession(userId) {
  const id = Number(userId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Sesion invalida.");
    error.status = 401;
    throw error;
  }

  const rows = await query(
    `
      SELECT
        u.id_usuario AS id,
        u.correo AS email,
        tu.nombre AS role,
        u.activo AS activo
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      WHERE u.id_usuario = ?
      LIMIT 1
    `,
    [id],
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("Sesion invalida.");
    error.status = 401;
    throw error;
  }

  if (Number(user.activo) === 0) {
    const error = new Error("El usuario esta inactivo.");
    error.status = 403;
    throw error;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

module.exports = {
  loginUser,
  getCurrentSession,
};
