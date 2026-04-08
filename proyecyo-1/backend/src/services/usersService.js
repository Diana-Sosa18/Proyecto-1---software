const bcrypt = require("bcryptjs");

const { pool, query } = require("../database/mysql");

const SALT_ROUNDS = 10;

function normalizeString(value) {
  return String(value || "").trim();
}

function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function generateAutoDpi() {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return `AUTO${timestamp}${random}`;
}

async function getUserTypeById(idTipoUsuario) {
  const rows = await query(
    `
      SELECT id_tipo_usuario AS id, nombre
      FROM TIPO_USUARIO
      WHERE id_tipo_usuario = ?
      LIMIT 1
    `,
    [idTipoUsuario],
  );

  return rows[0] || null;
}

async function ensureRoleRelation(connection, userId, roleName) {
  if (roleName === "residente") {
    await connection.execute("DELETE FROM INQUILINO_CASA WHERE id_inquilino IN (SELECT id_inquilino FROM INQUILINO WHERE id_usuario = ?)", [userId]);
    await connection.execute("DELETE FROM INQUILINO WHERE id_usuario = ?", [userId]);
    await connection.execute(
      `
        INSERT INTO RESIDENTE (id_usuario)
        SELECT ?
        WHERE NOT EXISTS (
          SELECT 1 FROM RESIDENTE WHERE id_usuario = ?
        )
      `,
      [userId, userId],
    );
    return;
  }

  if (roleName === "inquilino") {
    await connection.execute("DELETE FROM CASA WHERE id_residente IN (SELECT id_residente FROM RESIDENTE WHERE id_usuario = ?)", [userId]);
    await connection.execute("DELETE FROM RESIDENTE WHERE id_usuario = ?", [userId]);
    await connection.execute(
      `
        INSERT INTO INQUILINO (id_usuario, autorizado)
        SELECT ?, 1
        WHERE NOT EXISTS (
          SELECT 1 FROM INQUILINO WHERE id_usuario = ?
        )
      `,
      [userId, userId],
    );
    return;
  }

  await connection.execute("DELETE FROM INQUILINO_CASA WHERE id_inquilino IN (SELECT id_inquilino FROM INQUILINO WHERE id_usuario = ?)", [userId]);
  await connection.execute("DELETE FROM CASA WHERE id_residente IN (SELECT id_residente FROM RESIDENTE WHERE id_usuario = ?)", [userId]);
  await connection.execute("DELETE FROM INQUILINO WHERE id_usuario = ?", [userId]);
  await connection.execute("DELETE FROM RESIDENTE WHERE id_usuario = ?", [userId]);
}

function mapUser(row) {
  return {
    id_usuario: row.id_usuario,
    nombre: row.nombre,
    correo: row.correo,
    telefono: row.telefono,
    id_tipo_usuario: row.id_tipo_usuario,
    rol: row.rol,
  };
}

async function listUsers() {
  const rows = await query(
    `
      SELECT
        u.id_usuario,
        u.nombre,
        u.correo,
        u.telefono,
        u.id_tipo_usuario,
        tu.nombre AS rol
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      ORDER BY u.id_usuario DESC
    `,
  );

  return rows.map(mapUser);
}

async function getUserById(id) {
  const rows = await query(
    `
      SELECT
        u.id_usuario,
        u.nombre,
        u.correo,
        u.telefono,
        u.id_tipo_usuario,
        tu.nombre AS rol
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
    const error = new Error("Usuario no encontrado.");
    error.status = 404;
    throw error;
  }

  return mapUser(user);
}

async function createUser(payload) {
  const nombre = normalizeString(payload.nombre);
  const correo = normalizeString(payload.correo).toLowerCase();
  const telefono = normalizeString(payload.telefono);
  const password = normalizeString(payload.password);
  const idTipoUsuario = Number(payload.id_tipo_usuario);

  if (!nombre || !correo || !password || !idTipoUsuario) {
    const error = new Error("Nombre, correo, contrasena y tipo de usuario son obligatorios.");
    error.status = 400;
    throw error;
  }

  if (!validateEmail(correo)) {
    const error = new Error("El correo no es valido.");
    error.status = 400;
    throw error;
  }

  if (password.length < 4) {
    const error = new Error("La contrasena debe tener al menos 4 caracteres.");
    error.status = 400;
    throw error;
  }

  const userType = await getUserTypeById(idTipoUsuario);

  if (!userType) {
    const error = new Error("Tipo de usuario invalido.");
    error.status = 400;
    throw error;
  }

  const existingEmail = await query(
    "SELECT id_usuario FROM USUARIO WHERE correo = ? LIMIT 1",
    [correo],
  );

  if (existingEmail.length > 0) {
    const error = new Error("Ya existe un usuario con ese correo.");
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `
        INSERT INTO USUARIO (nombre, dpi, correo, telefono, password, activo, id_tipo_usuario)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `,
      [nombre, generateAutoDpi(), correo, telefono || null, hashedPassword, idTipoUsuario],
    );

    await ensureRoleRelation(connection, result.insertId, userType.nombre);
    await connection.commit();

    return getUserById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUser(id, payload) {
  await getUserById(id);
  const nombre = normalizeString(payload.nombre);
  const correo = normalizeString(payload.correo).toLowerCase();
  const telefono = normalizeString(payload.telefono);
  const password = normalizeString(payload.password);
  const idTipoUsuario = Number(payload.id_tipo_usuario);

  if (!nombre || !correo || !idTipoUsuario) {
    const error = new Error("Nombre, correo y tipo de usuario son obligatorios.");
    error.status = 400;
    throw error;
  }

  if (!validateEmail(correo)) {
    const error = new Error("El correo no es valido.");
    error.status = 400;
    throw error;
  }

  const userType = await getUserTypeById(idTipoUsuario);

  if (!userType) {
    const error = new Error("Tipo de usuario invalido.");
    error.status = 400;
    throw error;
  }

  const existingEmail = await query(
    "SELECT id_usuario FROM USUARIO WHERE correo = ? AND id_usuario <> ? LIMIT 1",
    [correo, id],
  );

  if (existingEmail.length > 0) {
    const error = new Error("Ya existe un usuario con ese correo.");
    error.status = 409;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (password) {
      if (password.length < 4) {
        const error = new Error("La contrasena debe tener al menos 4 caracteres.");
        error.status = 400;
        throw error;
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      await connection.execute(
        `
          UPDATE USUARIO
          SET nombre = ?, correo = ?, telefono = ?, password = ?, id_tipo_usuario = ?
          WHERE id_usuario = ?
        `,
        [nombre, correo, telefono || null, hashedPassword, idTipoUsuario, id],
      );
    } else {
      await connection.execute(
        `
          UPDATE USUARIO
          SET nombre = ?, correo = ?, telefono = ?, id_tipo_usuario = ?
          WHERE id_usuario = ?
        `,
        [nombre, correo, telefono || null, idTipoUsuario, id],
      );
    }

    await ensureRoleRelation(connection, id, userType.nombre);
    await connection.commit();

    return getUserById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteUser(id) {
  const user = await getUserById(id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute("DELETE FROM INQUILINO_CASA WHERE id_inquilino IN (SELECT id_inquilino FROM INQUILINO WHERE id_usuario = ?)", [id]);
    await connection.execute("DELETE FROM CASA WHERE id_residente IN (SELECT id_residente FROM RESIDENTE WHERE id_usuario = ?)", [id]);
    await connection.execute("DELETE FROM INQUILINO WHERE id_usuario = ?", [id]);
    await connection.execute("DELETE FROM RESIDENTE WHERE id_usuario = ?", [id]);
    await connection.execute("DELETE FROM USUARIO WHERE id_usuario = ?", [id]);

    await connection.commit();
    return user;
  } catch (error) {
    await connection.rollback();

    if (!error.status) {
      error.status = 409;
      error.message = "No fue posible eliminar el usuario porque tiene relaciones activas.";
    }

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
