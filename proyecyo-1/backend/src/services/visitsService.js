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

function ensureVisitType(value) {
  const normalized = normalizeString(value).toUpperCase();
  const allowed = ["VISITA", "DELIVERY", "PROVEEDOR"];

  if (!allowed.includes(normalized)) {
    const error = new Error("El tipo de visita es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

async function getResidentHouseByUserId(userId) {
  const rows = await query(
    `
      SELECT
        c.id_casa,
        c.numero,
        c.torre
      FROM CASA c
      INNER JOIN RESIDENTE r
        ON r.id_residente = c.id_residente
      WHERE r.id_usuario = ?
      LIMIT 1
    `,
    [userId],
  );

  const house = rows[0];

  if (!house) {
    const error = new Error("No se encontro una casa asociada al residente.");
    error.status = 404;
    throw error;
  }

  return house;
}

function mapVisit(row) {
  return {
    id_acceso: row.id_acceso,
    id_visitante: row.id_visitante,
    nombre: row.nombre,
    dpi: row.dpi,
    placa: row.placa,
    foto: row.foto || null,
    fecha: row.fecha,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    tipo_visita: row.tipo_visita,
    casa: row.casa,
  };
}

async function listResidentVisits(userId) {
  const house = await getResidentHouseByUserId(userId);
  const rows = await query(
    `
      SELECT
        a.id_acceso,
        v.id_visitante,
        v.nombre,
        v.dpi,
        v.placa,
        NULL AS foto,
        DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(a.hora_fin, '%H:%i') AS hora_fin,
        a.tipo_visita,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      WHERE a.id_casa = ?
      ORDER BY a.fecha DESC, a.hora_inicio DESC, a.id_acceso DESC
    `,
    [house.id_casa],
  );

  return rows.map(mapVisit);
}

async function listFrequentVisitors(userId) {
  const house = await getResidentHouseByUserId(userId);
  const rows = await query(
    `
      SELECT
        MAX(v.id_visitante) AS id_visitante,
        v.nombre,
        v.dpi,
        v.placa,
        COUNT(*) AS total_visitas,
        MAX(a.fecha) AS ultima_fecha
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      WHERE a.id_casa = ?
      GROUP BY v.nombre, v.dpi, v.placa
      ORDER BY total_visitas DESC, ultima_fecha DESC, v.nombre ASC
      LIMIT 5
    `,
    [house.id_casa],
  );

  return rows.map((row) => ({
    id_visitante: row.id_visitante,
    nombre: row.nombre,
    dpi: row.dpi,
    placa: row.placa,
    total_visitas: Number(row.total_visitas),
    ultima_fecha: row.ultima_fecha
      ? new Date(row.ultima_fecha).toISOString().slice(0, 10)
      : null,
  }));
}

async function createVisit(userId, payload) {
  const house = await getResidentHouseByUserId(userId);
  const nombre = normalizeString(payload.nombre);
  const dpi = normalizeString(payload.dpi);
  const placa = normalizeString(payload.placa).toUpperCase();
  const foto = normalizeString(payload.foto);
  const fecha = ensureValidDate(payload.fecha);
  const horaInicio = ensureValidTime(payload.hora_inicio, "hora de inicio");
  const horaFin = ensureValidTime(payload.hora_fin, "hora de fin");
  const tipoVisita = ensureVisitType(payload.tipo_visita);

  if (!nombre || !dpi || !placa) {
    const error = new Error("Nombre, DPI y placa son obligatorios.");
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

    const [visitorResult] = await connection.execute(
      `
        INSERT INTO VISITANTE (nombre, dpi, placa)
        VALUES (?, ?, ?)
      `,
      [nombre, dpi, placa],
    );

    const [accessResult] = await connection.execute(
      `
        INSERT INTO ACCESO (id_visitante, id_casa, fecha, hora_inicio, hora_fin, tipo_visita)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [visitorResult.insertId, house.id_casa, fecha, horaInicio, horaFin, tipoVisita],
    );

    await connection.commit();

    const rows = await query(
      `
        SELECT
          a.id_acceso,
          v.id_visitante,
          v.nombre,
          v.dpi,
          v.placa,
          ? AS foto,
          DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
          TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_inicio,
          TIME_FORMAT(a.hora_fin, '%H:%i') AS hora_fin,
          a.tipo_visita,
          CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
        FROM ACCESO a
        INNER JOIN VISITANTE v
          ON v.id_visitante = a.id_visitante
        INNER JOIN CASA c
          ON c.id_casa = a.id_casa
        WHERE a.id_acceso = ?
        LIMIT 1
      `,
      [foto || null, accessResult.insertId],
    );

    return mapVisit(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteVisit(userId, accessId) {
  const house = await getResidentHouseByUserId(userId);
  const normalizedAccessId = Number(accessId);

  if (!Number.isInteger(normalizedAccessId) || normalizedAccessId <= 0) {
    const error = new Error("La visita es invalida.");
    error.status = 400;
    throw error;
  }

  const rows = await query(
    `
      SELECT
        a.id_acceso,
        a.id_visitante,
        v.nombre,
        v.dpi,
        v.placa,
        DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(a.hora_fin, '%H:%i') AS hora_fin,
        a.tipo_visita,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      WHERE a.id_acceso = ? AND a.id_casa = ?
      LIMIT 1
    `,
    [normalizedAccessId, house.id_casa],
  );

  const visit = rows[0];

  if (!visit) {
    const error = new Error("Visita no encontrada.");
    error.status = 404;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM REGISTRO_ACCESO WHERE id_acceso = ?", [normalizedAccessId]);
    await connection.execute("DELETE FROM ACCESO WHERE id_acceso = ?", [normalizedAccessId]);
    await connection.execute(
      `
        DELETE FROM VISITANTE
        WHERE id_visitante = ?
          AND NOT EXISTS (
            SELECT 1
            FROM ACCESO
            WHERE id_visitante = ?
          )
      `,
      [visit.id_visitante, visit.id_visitante],
    );
    await connection.commit();

    return mapVisit(visit);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listResidentVisits,
  listFrequentVisitors,
  createVisit,
  deleteVisit,
};
