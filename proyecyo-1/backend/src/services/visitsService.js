const { pool, query } = require("../database/mysql");
const crypto = require("crypto");
const RESIDENTIAL_TIMEZONE = "America/Guatemala";

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

async function getHouseByUserId(userId, role = "residente") {
  const rows =
    role === "inquilino"
      ? await query(
          `
            SELECT
              c.id_casa,
              c.numero,
              c.torre
            FROM INQUILINO i
            INNER JOIN INQUILINO_CASA ic
              ON ic.id_inquilino = i.id_inquilino
            INNER JOIN CASA c
              ON c.id_casa = ic.id_casa
            WHERE i.id_usuario = ?
              AND i.autorizado = TRUE
            LIMIT 1
          `,
          [userId],
        )
      : await query(
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
    const error = new Error("No se encontro una casa asociada al usuario.");
    error.status = 404;
    throw error;
  }

  return house;
}

function mapVisit(row) {
  const qrStatus = getQrStatus(row);

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
    token_qr: row.token_qr,
    estado_acceso: row.estado_acceso,
    qr_status: qrStatus,
    qr_value: row.token_qr ? `NEXUSVISIT:${row.token_qr}` : null,
    casa: row.casa,
  };
}

function combineVisitDateTime(fecha, hora) {
  return new Date(`${fecha}T${hora && hora.length === 5 ? `${hora}:00` : hora}`);
}

function getCurrentDateTimeInTimezone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESIDENTIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

function getQrStatus(visit) {
  if (visit.estado_acceso === "INGRESO_REGISTRADO") {
    return "USED";
  }

  if (visit.estado_acceso === "CANCELADA") {
    return "CANCELLED";
  }

  const currentDateTime = getCurrentDateTimeInTimezone();

  if (
    currentDateTime.date > visit.fecha ||
    (currentDateTime.date === visit.fecha && currentDateTime.time > `${visit.hora_fin}:00`)
  ) {
    return "EXPIRED";
  }

  return "VALID";
}

function generateQrToken() {
  return crypto.randomBytes(18).toString("hex");
}

function normalizeQrToken(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    const error = new Error("El codigo QR es obligatorio.");
    error.status = 400;
    throw error;
  }

  return normalized.startsWith("NEXUSVISIT:") ? normalized.slice("NEXUSVISIT:".length) : normalized;
}

function getOwnerFilter(role) {
  return role === "inquilino" ? " AND a.id_usuario_autoriza = ?" : "";
}

function getOwnerParams(userId, role) {
  return role === "inquilino" ? [userId] : [];
}

async function listResidentVisits(userId, role = "residente") {
  const house = await getHouseByUserId(userId, role);
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
        a.token_qr,
        a.estado_acceso,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      WHERE a.id_casa = ?
        ${getOwnerFilter(role)}
      ORDER BY a.fecha DESC, a.hora_inicio DESC, a.id_acceso DESC
    `,
    [house.id_casa, ...getOwnerParams(userId, role)],
  );

  return rows.map(mapVisit);
}

async function listFrequentVisitors(userId, role = "residente") {
  const house = await getHouseByUserId(userId, role);
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
        ${getOwnerFilter(role)}
      GROUP BY v.nombre, v.dpi, v.placa
      ORDER BY total_visitas DESC, ultima_fecha DESC, v.nombre ASC
      LIMIT 5
    `,
    [house.id_casa, ...getOwnerParams(userId, role)],
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

async function createVisit(userId, role = "residente", payload) {
  const house = await getHouseByUserId(userId, role);
  const nombre = normalizeString(payload.nombre);
  const dpi = normalizeString(payload.dpi);
  const placa = normalizeString(payload.placa).toUpperCase();
  const foto = normalizeString(payload.foto);
  const fecha = ensureValidDate(payload.fecha);
  const horaInicio = ensureValidTime(payload.hora_inicio, "hora de inicio");
  const horaFin = ensureValidTime(payload.hora_fin, "hora de fin");
  const tipoVisita = ensureVisitType(payload.tipo_visita);
  const qrToken = generateQrToken();

  if (!nombre) {
    const error = new Error("El nombre del visitante es obligatorio.");
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
        INSERT INTO ACCESO (id_visitante, id_casa, id_usuario_autoriza, fecha, hora_inicio, hora_fin, tipo_visita, token_qr, estado_acceso)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AUTORIZADA')
      `,
      [visitorResult.insertId, house.id_casa, userId, fecha, horaInicio, horaFin, tipoVisita, qrToken],
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
          a.token_qr,
          a.estado_acceso,
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

async function deleteVisit(userId, role = "residente", accessId) {
  const house = await getHouseByUserId(userId, role);
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
        a.token_qr,
        a.estado_acceso,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      WHERE a.id_acceso = ? AND a.id_casa = ?
        ${getOwnerFilter(role)}
      LIMIT 1
    `,
    [normalizedAccessId, house.id_casa, ...getOwnerParams(userId, role)],
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

async function deleteFrequentVisitor(userId, role = "residente", visitorId) {
  const house = await getHouseByUserId(userId, role);
  const normalizedVisitorId = Number(visitorId);

  if (!Number.isInteger(normalizedVisitorId) || normalizedVisitorId <= 0) {
    const error = new Error("El visitante es invalido.");
    error.status = 400;
    throw error;
  }

  const rows = await query(
    `
      SELECT v.id_visitante, v.nombre
      FROM VISITANTE v
      INNER JOIN ACCESO a ON a.id_visitante = v.id_visitante
      WHERE v.id_visitante = ? AND a.id_casa = ?
        ${getOwnerFilter(role)}
      LIMIT 1
    `,
    [normalizedVisitorId, house.id_casa, ...getOwnerParams(userId, role)],
  );

  const visitor = rows[0];

  if (!visitor) {
    const error = new Error("Visitante frecuente no encontrado.");
    error.status = 404;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        DELETE ra FROM REGISTRO_ACCESO ra
        INNER JOIN ACCESO a ON a.id_acceso = ra.id_acceso
        WHERE a.id_visitante = ? AND a.id_casa = ?
          ${getOwnerFilter(role)}
      `,
      [normalizedVisitorId, house.id_casa, ...getOwnerParams(userId, role)],
    );
    await connection.execute(
      `DELETE FROM ACCESO WHERE id_visitante = ? AND id_casa = ? ${getOwnerFilter(role)}`,
      [normalizedVisitorId, house.id_casa, ...getOwnerParams(userId, role)],
    );
    await connection.execute(
      `
        DELETE FROM VISITANTE
        WHERE id_visitante = ?
          AND NOT EXISTS (
            SELECT 1 FROM ACCESO WHERE id_visitante = ?
          )
      `,
      [normalizedVisitorId, normalizedVisitorId],
    );
    await connection.commit();

    return { id_visitante: normalizedVisitorId, nombre: visitor.nombre };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getGuardShiftVisits() {
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
        a.token_qr,
        a.estado_acceso,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      ORDER BY a.fecha DESC, a.hora_inicio DESC, a.id_acceso DESC
      LIMIT 20
    `,
  );

  return rows.map(mapVisit);
}

async function validateQrVisit(qrToken) {
  const normalizedToken = normalizeQrToken(qrToken);
  const mappedVisit = await findVisitByQrToken(normalizedToken);

  if (mappedVisit.qr_status === "USED") {
    const error = new Error("Este QR ya fue utilizado.");
    error.status = 409;
    throw error;
  }

  if (mappedVisit.qr_status === "EXPIRED") {
    const error = new Error("QR expirado.");
    error.status = 410;
    throw error;
  }

  if (mappedVisit.qr_status === "CANCELLED") {
    const error = new Error("Este QR ya no es valido.");
    error.status = 410;
    throw error;
  }

  return mappedVisit;
}

async function findVisitByQrToken(normalizedToken) {
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
        a.token_qr,
        a.estado_acceso,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS casa
      FROM ACCESO a
      INNER JOIN VISITANTE v
        ON v.id_visitante = a.id_visitante
      INNER JOIN CASA c
        ON c.id_casa = a.id_casa
      WHERE a.token_qr = ?
      LIMIT 1
    `,
    [normalizedToken],
  );

  const visit = rows[0];

  if (!visit) {
    const error = new Error("QR no reconocido.");
    error.status = 404;
    throw error;
  }

  return mapVisit(visit);
}

async function registerQrEntry(qrToken) {
  const normalizedToken = normalizeQrToken(qrToken);
  const visit = await validateQrVisit(normalizedToken);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        UPDATE ACCESO
        SET estado_acceso = 'INGRESO_REGISTRADO'
        WHERE id_acceso = ?
      `,
      [visit.id_acceso],
    );
    await connection.execute(
      `
        INSERT INTO REGISTRO_ACCESO (id_acceso, hora_ingreso)
        VALUES (?, CURTIME())
        ON DUPLICATE KEY UPDATE hora_ingreso = VALUES(hora_ingreso)
      `,
      [visit.id_acceso],
    );
    await connection.commit();

    return findVisitByQrToken(normalizedToken);
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
  deleteFrequentVisitor,
  getGuardShiftVisits,
  validateQrVisit,
  registerQrEntry,
};
