const bcrypt = require("bcryptjs");

const { pool, query } = require("../database/mysql");

const SALT_ROUNDS = 10;

const USER_HOUSE_SUBQUERY = `
  SELECT
    grouped_houses.id_usuario,
    SUBSTRING_INDEX(
      GROUP_CONCAT(grouped_houses.numero_casa ORDER BY grouped_houses.sort_key SEPARATOR '||'),
      '||',
      1
    ) AS numero_casa,
    NULLIF(
      SUBSTRING_INDEX(
        GROUP_CONCAT(COALESCE(grouped_houses.torre, '') ORDER BY grouped_houses.sort_key SEPARATOR '||'),
        '||',
        1
      ),
      ''
    ) AS torre,
    GROUP_CONCAT(DISTINCT grouped_houses.unidad ORDER BY grouped_houses.unidad SEPARATOR ', ') AS unidad
  FROM (
    SELECT
      r.id_usuario,
      c.id_casa AS sort_key,
      c.numero AS numero_casa,
      c.torre,
      CONCAT(
        COALESCE(c.torre, ''),
        CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
        c.numero
      ) AS unidad
    FROM RESIDENTE r
    INNER JOIN CASA c
      ON c.id_residente = r.id_residente

    UNION ALL

    SELECT
      i.id_usuario,
      c.id_casa AS sort_key,
      c.numero AS numero_casa,
      c.torre,
      CONCAT(
        COALESCE(c.torre, ''),
        CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
        c.numero
      ) AS unidad
    FROM INQUILINO i
    INNER JOIN INQUILINO_CASA ic
      ON ic.id_inquilino = i.id_inquilino
    INNER JOIN CASA c
      ON c.id_casa = ic.id_casa
  ) grouped_houses
  GROUP BY grouped_houses.id_usuario
`;

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

function normalizeHousePayload(payload) {
  return {
    numeroCasa: normalizeString(payload.numero_casa),
    torre: normalizeString(payload.torre) || null,
  };
}

function ensureHousePayloadForRole(roleName, payload) {
  const house = normalizeHousePayload(payload);

  if (roleName === "residente" || roleName === "inquilino") {
    if (!house.numeroCasa) {
      const error = new Error("La casa es obligatoria para residentes e inquilinos.");
      error.status = 400;
      throw error;
    }
  }

  return house;
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

async function getResidentIdByUserId(connection, userId) {
  const [rows] = await connection.execute(
    `
      SELECT id_residente
      FROM RESIDENTE
      WHERE id_usuario = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0]?.id_residente ? Number(rows[0].id_residente) : null;
}

async function getInquilinoIdByUserId(connection, userId) {
  const [rows] = await connection.execute(
    `
      SELECT id_inquilino
      FROM INQUILINO
      WHERE id_usuario = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0]?.id_inquilino ? Number(rows[0].id_inquilino) : null;
}

async function ensureResidentRecord(connection, userId) {
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

  const residentId = await getResidentIdByUserId(connection, userId);

  if (!residentId) {
    const error = new Error("No fue posible crear la relacion del residente.");
    error.status = 500;
    throw error;
  }

  return residentId;
}

async function ensureInquilinoRecord(connection, userId) {
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

  const inquilinoId = await getInquilinoIdByUserId(connection, userId);

  if (!inquilinoId) {
    const error = new Error("No fue posible crear la relacion del inquilino.");
    error.status = 500;
    throw error;
  }

  return inquilinoId;
}

async function removeTenantData(connection, userId) {
  await connection.execute(
    `
      DELETE FROM INQUILINO_CASA
      WHERE id_inquilino IN (
        SELECT id_inquilino
        FROM INQUILINO
        WHERE id_usuario = ?
      )
    `,
    [userId],
  );
  await connection.execute("DELETE FROM INQUILINO WHERE id_usuario = ?", [userId]);
}

async function removeResidentData(connection, userId) {
  await connection.execute(
    `
      DELETE FROM INQUILINO_CASA
      WHERE id_casa IN (
        SELECT c.id_casa
        FROM CASA c
        INNER JOIN RESIDENTE r
          ON r.id_residente = c.id_residente
        WHERE r.id_usuario = ?
      )
    `,
    [userId],
  );
  await connection.execute(
    `
      DELETE FROM CASA
      WHERE id_residente IN (
        SELECT id_residente
        FROM RESIDENTE
        WHERE id_usuario = ?
      )
    `,
    [userId],
  );
  await connection.execute("DELETE FROM RESIDENTE WHERE id_usuario = ?", [userId]);
}

async function assignResidentHouse(connection, userId, house) {
  const residentId = await ensureResidentRecord(connection, userId);

  const [conflictRows] = await connection.execute(
    `
      SELECT c.id_casa
      FROM CASA c
      WHERE c.numero = ?
        AND (
          (? IS NULL AND (c.torre IS NULL OR c.torre = ''))
          OR c.torre = ?
        )
        AND c.id_residente <> ?
      LIMIT 1
    `,
    [house.numeroCasa, house.torre, house.torre, residentId],
  );

  if (conflictRows.length > 0) {
    const error = new Error("La casa indicada ya esta asignada a otro residente.");
    error.status = 409;
    throw error;
  }

  const [existingRows] = await connection.execute(
    `
      SELECT id_casa
      FROM CASA
      WHERE id_residente = ?
      ORDER BY id_casa ASC
      LIMIT 1
      FOR UPDATE
    `,
    [residentId],
  );

  if (existingRows.length > 0) {
    await connection.execute(
      `
        UPDATE CASA
        SET numero = ?, torre = ?
        WHERE id_casa = ?
      `,
      [house.numeroCasa, house.torre, existingRows[0].id_casa],
    );
    return;
  }

  await connection.execute(
    `
      INSERT INTO CASA (numero, torre, id_residente)
      VALUES (?, ?, ?)
    `,
    [house.numeroCasa, house.torre, residentId],
  );
}

async function assignTenantHouse(connection, userId, house) {
  const inquilinoId = await ensureInquilinoRecord(connection, userId);
  const [houseRows] = await connection.execute(
    `
      SELECT id_casa
      FROM CASA
      WHERE numero = ?
        AND (
          (? IS NULL AND (torre IS NULL OR torre = ''))
          OR torre = ?
        )
      ORDER BY id_casa ASC
      LIMIT 1
    `,
    [house.numeroCasa, house.torre, house.torre],
  );

  if (houseRows.length === 0) {
    const error = new Error(
      "La casa indicada no existe. Para inquilinos debes ingresar una casa ya registrada para un residente.",
    );
    error.status = 400;
    throw error;
  }

  await connection.execute("DELETE FROM INQUILINO_CASA WHERE id_inquilino = ?", [inquilinoId]);
  await connection.execute(
    `
      INSERT INTO INQUILINO_CASA (id_inquilino, id_casa)
      VALUES (?, ?)
    `,
    [inquilinoId, houseRows[0].id_casa],
  );
}

async function syncRoleRelations(connection, userId, roleName, house) {
  if (roleName === "residente") {
    await removeTenantData(connection, userId);
    await assignResidentHouse(connection, userId, house);
    return;
  }

  if (roleName === "inquilino") {
    await removeResidentData(connection, userId);
    await assignTenantHouse(connection, userId, house);
    return;
  }

  await removeTenantData(connection, userId);
  await removeResidentData(connection, userId);
}

function mapUser(row) {
  return {
    id_usuario: row.id_usuario,
    nombre: row.nombre,
    correo: row.correo,
    telefono: row.telefono,
    id_tipo_usuario: row.id_tipo_usuario,
    rol: row.rol,
    unidad: row.unidad || null,
    numero_casa: row.numero_casa || null,
    torre: row.torre || null,
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
        tu.nombre AS rol,
        casa.unidad,
        casa.numero_casa,
        casa.torre
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_HOUSE_SUBQUERY}) casa
        ON casa.id_usuario = u.id_usuario
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
        tu.nombre AS rol,
        casa.unidad,
        casa.numero_casa,
        casa.torre
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_HOUSE_SUBQUERY}) casa
        ON casa.id_usuario = u.id_usuario
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

  const house = ensureHousePayloadForRole(userType.nombre, payload);
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

    await syncRoleRelations(connection, result.insertId, userType.nombre, house);
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

  const house = ensureHousePayloadForRole(userType.nombre, payload);
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

    await syncRoleRelations(connection, id, userType.nombre, house);
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

    await connection.execute(
      `
        DELETE FROM INQUILINO_CASA
        WHERE id_inquilino IN (
          SELECT id_inquilino
          FROM INQUILINO
          WHERE id_usuario = ?
        )
      `,
      [id],
    );
    await connection.execute(
      `
        DELETE FROM INQUILINO_CASA
        WHERE id_casa IN (
          SELECT c.id_casa
          FROM CASA c
          INNER JOIN RESIDENTE r
            ON r.id_residente = c.id_residente
          WHERE r.id_usuario = ?
        )
      `,
      [id],
    );
    await connection.execute(
      `
        DELETE FROM CASA
        WHERE id_residente IN (
          SELECT id_residente
          FROM RESIDENTE
          WHERE id_usuario = ?
        )
      `,
      [id],
    );
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
