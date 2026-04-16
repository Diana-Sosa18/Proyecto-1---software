const { pool, query } = require("../database/mysql");

function normalizeString(value) {
  return String(value || "").trim();
}

function ensureValidDate(value) {
  const normalized = normalizeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error("La fecha es obligatoria y debe tener formato YYYY-MM-DD.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function ensureValidTime(value, fieldName) {
  const normalized = normalizeString(value);

  if (!/^\d{2}:\d{2}$/.test(normalized) && !/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    const error = new Error(`La ${fieldName} es obligatoria y debe tener formato HH:MM.`);
    error.status = 400;
    throw error;
  }

  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function mapReservation(row) {
  return {
    id_usuario: row.id_usuario,
    id_amenidad: row.id_amenidad,
    amenidad_nombre: row.amenidad_nombre,
    fecha: row.fecha,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
  };
}

async function ensureDefaultAmenities(connection) {
  const [countRows] = await connection.execute("SELECT COUNT(*) AS total FROM AMENIDAD");
  const total = Number(countRows[0]?.total || 0);

  if (total > 0) {
    return;
  }

  await connection.execute(
    `
      INSERT INTO AMENIDAD (nombre)
      VALUES ('Salon Social'), ('Cancha'), ('Area BBQ'), ('Piscina')
    `,
  );
}

async function listAmenities() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureDefaultAmenities(connection);
    const [rows] = await connection.execute(
      `
        SELECT id_amenidad, nombre
        FROM AMENIDAD
        ORDER BY nombre ASC
      `,
    );
    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listReservationsByRange(fromDate, toDate) {
  const from = ensureValidDate(fromDate);
  const to = ensureValidDate(toDate);

  if (from > to) {
    const error = new Error("El rango de fechas es invalido.");
    error.status = 400;
    throw error;
  }

  const rows = await query(
    `
      SELECT
        r.id_usuario,
        r.id_amenidad,
        a.nombre AS amenidad_nombre,
        DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(r.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(r.hora_fin, '%H:%i') AS hora_fin
      FROM RESERVA r
      INNER JOIN AMENIDAD a
        ON a.id_amenidad = r.id_amenidad
      WHERE r.fecha BETWEEN ? AND ?
      ORDER BY r.fecha ASC, r.hora_inicio ASC
    `,
    [from, to],
  );

  return rows.map(mapReservation);
}

async function createAmenityReservation(userId, payload) {
  const amenityId = Number(payload.id_amenidad);
  const fecha = ensureValidDate(payload.fecha);
  const horaInicio = ensureValidTime(payload.hora_inicio, "hora de inicio");
  const horaFin = ensureValidTime(payload.hora_fin, "hora de fin");

  if (!Number.isInteger(amenityId) || amenityId <= 0) {
    const error = new Error("La amenidad es invalida.");
    error.status = 400;
    throw error;
  }

  if (horaInicio >= horaFin) {
    const error = new Error("La hora de fin debe ser mayor a la hora de inicio.");
    error.status = 400;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await ensureDefaultAmenities(connection);

    const [amenityRows] = await connection.execute(
      `
        SELECT id_amenidad, nombre
        FROM AMENIDAD
        WHERE id_amenidad = ?
        LIMIT 1
      `,
      [amenityId],
    );
    const amenity = amenityRows[0];

    if (!amenity) {
      const error = new Error("La amenidad seleccionada no existe.");
      error.status = 404;
      throw error;
    }

    const [conflictRows] = await connection.execute(
      `
        SELECT id_usuario
        FROM RESERVA
        WHERE id_amenidad = ?
          AND fecha = ?
          AND hora_inicio < ?
          AND hora_fin > ?
        LIMIT 1
        FOR UPDATE
      `,
      [amenityId, fecha, horaFin, horaInicio],
    );

    if (conflictRows.length > 0) {
      const error = new Error("El horario seleccionado ya esta ocupado para esta amenidad.");
      error.status = 409;
      throw error;
    }

    await connection.execute(
      `
        INSERT INTO RESERVA (id_usuario, id_amenidad, fecha, hora_inicio, hora_fin)
        VALUES (?, ?, ?, ?, ?)
      `,
      [userId, amenityId, fecha, horaInicio, horaFin],
    );

    await connection.commit();

    return {
      id_usuario: userId,
      id_amenidad: amenityId,
      amenidad_nombre: amenity.nombre,
      fecha,
      hora_inicio: horaInicio.slice(0, 5),
      hora_fin: horaFin.slice(0, 5),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listAmenities,
  listReservationsByRange,
  createAmenityReservation,
};
