const { pool, query } = require("../database/mysql");
const { ensureValidDate, ensureValidTime } = require("../utils/dateTimeValidation");

const RESIDENTIAL_TIMEZONE = "America/Guatemala";
const MAX_ACTIVE_RESERVATIONS_PER_USER = 3;
const RESERVATION_LIMIT_MESSAGE =
  "El usuario ya alcanzo el limite de reservas activas permitidas.";

const DEFAULT_AMENITIES = [
  {
    legacyNames: ["Salon Social"],
    nombre: "Salon de eventos",
    descripcion: "Espacio para celebraciones privadas y reuniones.",
    hora_apertura: "08:00:00",
    hora_cierre: "22:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
  {
    legacyNames: ["Cancha"],
    nombre: "Cancha de tenis",
    descripcion: "Cancha al aire libre para entrenamientos y partidos.",
    hora_apertura: "06:00:00",
    hora_cierre: "21:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
  {
    legacyNames: [],
    nombre: "Piscina",
    descripcion: "Piscina familiar con control por bloques de uso.",
    hora_apertura: "08:00:00",
    hora_cierre: "20:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
  {
    legacyNames: [],
    nombre: "Gimnasio",
    descripcion: "Zona de entrenamiento con acceso por franjas horarias.",
    hora_apertura: "05:00:00",
    hora_cierre: "22:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
  {
    legacyNames: ["Area BBQ"],
    nombre: "Area de parrillas",
    descripcion: "Area social con estaciones de parrilla y mesas.",
    hora_apertura: "09:00:00",
    hora_cierre: "23:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
  {
    legacyNames: [],
    nombre: "Salon infantil",
    descripcion: "Salon recreativo para actividades infantiles.",
    hora_apertura: "09:00:00",
    hora_cierre: "19:00:00",
    intervalo_minutos: 60,
    activo: true,
  },
];

const USER_UNIT_SUBQUERY = `
  SELECT
    grouped_units.id_usuario,
    GROUP_CONCAT(DISTINCT grouped_units.unidad ORDER BY grouped_units.unidad SEPARATOR ', ') AS unidad
  FROM (
    SELECT
      r.id_usuario,
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
  ) grouped_units
  GROUP BY grouped_units.id_usuario
`;

function normalizeString(value) {
  return String(value || "").trim();
}

function ensurePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`El campo ${fieldName} es invalido.`);
    error.status = 400;
    throw error;
  }

  return parsed;
}

function ensureValidInterval(value) {
  const parsed = ensurePositiveInteger(value, "intervalo_minutos");

  if (![15, 30, 60].includes(parsed)) {
    const error = new Error("El intervalo debe ser de 15, 30 o 60 minutos.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

function ensureBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

function toMinutes(time) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
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

function createReservationKey(reservation) {
  return [
    reservation.id_usuario,
    reservation.id_amenidad,
    reservation.fecha,
    reservation.hora_inicio,
  ].join("-");
}

function parseReservationKey(value) {
  const match = normalizeString(value).match(/^(\d+)-(\d+)-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/);

  if (!match) {
    const error = new Error("La reserva indicada no es valida.");
    error.status = 400;
    throw error;
  }

  return {
    id_usuario: Number(match[1]),
    id_amenidad: Number(match[2]),
    fecha: match[3],
    hora_inicio: `${match[4]}:00`,
  };
}

function mapAmenity(row) {
  return {
    id_amenidad: Number(row.id_amenidad),
    nombre: row.nombre,
    descripcion: row.descripcion || "",
    hora_apertura: row.hora_apertura,
    hora_cierre: row.hora_cierre,
    intervalo_minutos: Number(row.intervalo_minutos || 60),
    activo: Boolean(row.activo),
  };
}

function getCurrentReservationStatus(row) {
  const configuredStatus = normalizeString(row.estado).toUpperCase() || "CONFIRMADA";

  if (configuredStatus === "CANCELADA") {
    return "CANCELADA";
  }

  const currentDateTime = getCurrentDateTimeInTimezone();

  if (
    currentDateTime.date > row.fecha ||
    (currentDateTime.date === row.fecha && currentDateTime.time >= `${row.hora_fin}:00`)
  ) {
    return "FINALIZADA";
  }

  if (
    currentDateTime.date === row.fecha &&
    currentDateTime.time >= `${row.hora_inicio}:00` &&
    currentDateTime.time < `${row.hora_fin}:00`
  ) {
    return "EN_CURSO";
  }

  if (configuredStatus === "PENDIENTE") {
    return "PENDIENTE";
  }

  return "CONFIRMADA";
}

function mapReservation(row, includeUserDetails) {
  const mapped = {
    reservation_key: createReservationKey(row),
    id_usuario: Number(row.id_usuario),
    id_amenidad: Number(row.id_amenidad),
    amenidad_nombre: row.amenidad_nombre,
    fecha: row.fecha,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    estado: normalizeString(row.estado).toUpperCase() || "CONFIRMADA",
    estado_actual: getCurrentReservationStatus(row),
  };

  if (includeUserDetails) {
    mapped.usuario_nombre = row.usuario_nombre;
    mapped.usuario_rol = row.usuario_rol;
    mapped.unidad = row.unidad || "Sin unidad";
  }

  return mapped;
}

function buildSlots(horaApertura, horaCierre, intervaloMinutos) {
  const openingMinutes = toMinutes(horaApertura);
  const closingMinutes = toMinutes(horaCierre);
  const slots = [];

  for (
    let cursor = openingMinutes;
    cursor + intervaloMinutos <= closingMinutes;
    cursor += intervaloMinutos
  ) {
    slots.push({
      hora_inicio: formatMinutesToTime(cursor),
      hora_fin: formatMinutesToTime(cursor + intervaloMinutos),
    });
  }

  return slots;
}

function validateReservationRange(amenity, fecha, horaInicio, horaFin) {
  if (!amenity.activo) {
    const error = new Error("La amenidad seleccionada no esta disponible.");
    error.status = 409;
    throw error;
  }

  if (horaInicio >= horaFin) {
    const error = new Error("La hora de fin debe ser mayor a la hora de inicio.");
    error.status = 400;
    throw error;
  }

  const startMinutes = toMinutes(horaInicio);
  const endMinutes = toMinutes(horaFin);
  const openingMinutes = toMinutes(amenity.hora_apertura);
  const closingMinutes = toMinutes(amenity.hora_cierre);

  if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
    const error = new Error("El horario seleccionado esta fuera de la ventana disponible de la amenidad.");
    error.status = 400;
    throw error;
  }

  if (
    (startMinutes - openingMinutes) % amenity.intervalo_minutos !== 0 ||
    (endMinutes - openingMinutes) % amenity.intervalo_minutos !== 0
  ) {
    const error = new Error("El horario debe respetar el intervalo configurado para la amenidad.");
    error.status = 400;
    throw error;
  }

  const currentDateTime = getCurrentDateTimeInTimezone();

  if (
    fecha < currentDateTime.date ||
    (fecha === currentDateTime.date && horaInicio <= currentDateTime.time)
  ) {
    const error = new Error("No se pueden registrar reservas en horarios pasados.");
    error.status = 400;
    throw error;
  }
}

function assertReservationChangeAllowed(reservation) {
  const currentDateTime = getCurrentDateTimeInTimezone();
  const reservationStart = new Date(`${reservation.fecha}T${reservation.hora_inicio}:00`);
  const now = new Date(`${currentDateTime.date}T${currentDateTime.time}`);
  const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / 60000;

  if (String(reservation.estado || "").toUpperCase() === "CANCELADA") {
    const error = new Error("La reserva ya fue cancelada.");
    error.status = 409;
    throw error;
  }

  if (minutesUntilStart < 120) {
    const error = new Error("Solo puedes modificar o cancelar reservas con al menos 2 horas de anticipacion.");
    error.status = 409;
    throw error;
  }
}

async function getReservationForChange(connection, key, viewer, lockRow) {
  const [rows] = await connection.execute(
    `
      SELECT
        r.id_usuario,
        r.id_amenidad,
        a.nombre AS amenidad_nombre,
        DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(r.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(r.hora_fin, '%H:%i') AS hora_fin,
        COALESCE(r.estado, 'CONFIRMADA') AS estado,
        u.nombre AS usuario_nombre,
        tu.nombre AS usuario_rol,
        COALESCE(unidad.unidad, 'Sin unidad') AS unidad
      FROM RESERVA r
      INNER JOIN AMENIDAD a
        ON a.id_amenidad = r.id_amenidad
      INNER JOIN USUARIO u
        ON u.id_usuario = r.id_usuario
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
        ON unidad.id_usuario = u.id_usuario
      WHERE r.id_usuario = ?
        AND r.id_amenidad = ?
        AND r.fecha = ?
        AND r.hora_inicio = ?
        AND r.id_usuario = ?
      LIMIT 1
      ${lockRow ? "FOR UPDATE" : ""}
    `,
    [key.id_usuario, key.id_amenidad, key.fecha, key.hora_inicio, viewer.id],
  );

  const reservation = rows[0];

  if (!reservation) {
    const error = new Error("Reserva no encontrada para el residente autenticado.");
    error.status = 404;
    throw error;
  }

  return reservation;
}

async function insertReservationHistory(connection, before, after, action, viewer) {
  await connection.execute(
    `
      INSERT INTO HISTORIAL_RESERVA (
        id_usuario,
        id_amenidad,
        fecha_anterior,
        hora_inicio_anterior,
        hora_fin_anterior,
        fecha_nueva,
        hora_inicio_nueva,
        hora_fin_nueva,
        estado_anterior,
        estado_nuevo,
        accion,
        detalle,
        realizado_por,
        realizado_por_nombre
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      before.id_usuario,
      before.id_amenidad,
      before.fecha,
      before.hora_inicio,
      before.hora_fin,
      after?.fecha || before.fecha,
      after?.hora_inicio || before.hora_inicio,
      after?.hora_fin || before.hora_fin,
      before.estado,
      after?.estado || before.estado,
      action,
      action === "CANCELACION"
        ? `${viewer.nombre} cancelo la reserva de ${before.amenidad_nombre}.`
        : `${viewer.nombre} modifico la reserva de ${before.amenidad_nombre}.`,
      viewer.id,
      viewer.nombre,
    ],
  );
}

async function ensureAmenityCatalog(connection) {
  const [existingRows] = await connection.execute(`
    SELECT id_amenidad, nombre, descripcion, hora_apertura, hora_cierre, intervalo_minutos, activo
    FROM AMENIDAD
    ORDER BY id_amenidad ASC
  `);

  const names = new Set(existingRows.map((row) => normalizeString(row.nombre).toLowerCase()));

  for (const amenity of DEFAULT_AMENITIES) {
    for (const legacyName of amenity.legacyNames) {
      const normalizedLegacyName = legacyName.toLowerCase();
      const normalizedCurrentName = amenity.nombre.toLowerCase();

      if (names.has(normalizedLegacyName) && !names.has(normalizedCurrentName)) {
        await connection.execute(
          `
            UPDATE AMENIDAD
            SET nombre = ?
            WHERE LOWER(nombre) = ?
          `,
          [amenity.nombre, normalizedLegacyName],
        );
        names.delete(normalizedLegacyName);
        names.add(normalizedCurrentName);
      }
    }
  }

  for (const amenity of DEFAULT_AMENITIES) {
    const normalizedName = amenity.nombre.toLowerCase();

    if (!names.has(normalizedName)) {
      await connection.execute(
        `
          INSERT INTO AMENIDAD (
            nombre,
            descripcion,
            hora_apertura,
            hora_cierre,
            intervalo_minutos,
            activo
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          amenity.nombre,
          amenity.descripcion,
          amenity.hora_apertura,
          amenity.hora_cierre,
          amenity.intervalo_minutos,
          amenity.activo ? 1 : 0,
        ],
      );
      names.add(normalizedName);
      continue;
    }

    await connection.execute(
      `
        UPDATE AMENIDAD
        SET
          descripcion = COALESCE(NULLIF(descripcion, ''), ?),
          hora_apertura = COALESCE(hora_apertura, ?),
          hora_cierre = COALESCE(hora_cierre, ?),
          intervalo_minutos = COALESCE(intervalo_minutos, ?),
          activo = COALESCE(activo, ?)
        WHERE LOWER(nombre) = ?
      `,
      [
        amenity.descripcion,
        amenity.hora_apertura,
        amenity.hora_cierre,
        amenity.intervalo_minutos,
        amenity.activo ? 1 : 0,
        normalizedName,
      ],
    );
  }
}

async function getAmenityRecord(connection, amenityId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id_amenidad,
        nombre,
        COALESCE(descripcion, '') AS descripcion,
        TIME_FORMAT(hora_apertura, '%H:%i') AS hora_apertura,
        TIME_FORMAT(hora_cierre, '%H:%i') AS hora_cierre,
        intervalo_minutos,
        activo
      FROM AMENIDAD
      WHERE id_amenidad = ?
      LIMIT 1
    `,
    [amenityId],
  );

  const amenity = rows[0];

  if (!amenity) {
    const error = new Error("La amenidad seleccionada no existe.");
    error.status = 404;
    throw error;
  }

  return mapAmenity(amenity);
}

async function getReservableUserRecord(connection, userId) {
  const [rows] = await connection.execute(
    `
      SELECT
        u.id_usuario,
        u.nombre,
        tu.nombre AS rol,
        COALESCE(unidad.unidad, 'Sin unidad') AS unidad
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
        ON unidad.id_usuario = u.id_usuario
      WHERE u.id_usuario = ?
        AND u.activo = 1
        AND tu.nombre IN ('residente', 'inquilino')
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("El usuario seleccionado no puede reservar amenidades.");
    error.status = 400;
    throw error;
  }

  return {
    id_usuario: Number(user.id_usuario),
    nombre: user.nombre,
    rol: user.rol,
    unidad: user.unidad || "Sin unidad",
  };
}

async function getUserName(connection, userId) {
  const [rows] = await connection.execute(
    "SELECT nombre FROM USUARIO WHERE id_usuario = ? LIMIT 1",
    [userId],
  );

  return rows[0]?.nombre || "Usuario";
}

async function findReservationConflict(connection, amenityId, fecha, horaInicio, horaFin, lockRow) {
  const [rows] = await connection.execute(
    `
      SELECT
        r.id_usuario,
        r.id_amenidad,
        a.nombre AS amenidad_nombre,
        DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(r.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(r.hora_fin, '%H:%i') AS hora_fin,
        COALESCE(r.estado, 'CONFIRMADA') AS estado,
        u.nombre AS usuario_nombre,
        tu.nombre AS usuario_rol,
        COALESCE(unidad.unidad, 'Sin unidad') AS unidad
      FROM RESERVA r
      INNER JOIN AMENIDAD a
        ON a.id_amenidad = r.id_amenidad
      INNER JOIN USUARIO u
        ON u.id_usuario = r.id_usuario
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
        ON unidad.id_usuario = u.id_usuario
      WHERE r.id_amenidad = ?
        AND r.fecha = ?
        AND COALESCE(r.estado, 'CONFIRMADA') <> 'CANCELADA'
        AND r.hora_inicio < ?
        AND r.hora_fin > ?
      ORDER BY r.hora_inicio ASC
      LIMIT 1
      ${lockRow ? "FOR UPDATE" : ""}
    `,
    [amenityId, fecha, horaFin, horaInicio],
  );

  return rows[0] || null;
}

async function countActiveReservationsByUser(connection, userId, lockRows) {
  const currentDateTime = getCurrentDateTimeInTimezone();
  const [rows] = await connection.execute(
    `
      SELECT
        id_usuario
      FROM RESERVA
      WHERE id_usuario = ?
        AND COALESCE(estado, 'CONFIRMADA') <> 'CANCELADA'
        AND (
          fecha > ?
          OR (fecha = ? AND hora_fin > ?)
        )
      ${lockRows ? "FOR UPDATE" : ""}
    `,
    [userId, currentDateTime.date, currentDateTime.date, currentDateTime.time],
  );

  return rows.length;
}

async function getReservationLimitStatus(connection, userId, lockRows = false) {
  const activeReservations = await countActiveReservationsByUser(connection, userId, lockRows);

  return {
    limite: MAX_ACTIVE_RESERVATIONS_PER_USER,
    reservas_activas: activeReservations,
    limite_alcanzado: activeReservations >= MAX_ACTIVE_RESERVATIONS_PER_USER,
  };
}

function throwReservationLimitError() {
  const error = new Error(RESERVATION_LIMIT_MESSAGE);
  error.status = 409;
  error.code = "ACTIVE_RESERVATION_LIMIT_REACHED";
  throw error;
}

async function assertNoActiveAmenitySanction(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT s.id_sancion, s.motivo FROM SANCION s
      INNER JOIN (SELECT c.id_casa, r.id_usuario FROM CASA c INNER JOIN RESIDENTE r ON r.id_residente=c.id_residente
                  UNION SELECT ic.id_casa, i.id_usuario FROM INQUILINO_CASA ic INNER JOIN INQUILINO i ON i.id_inquilino=ic.id_inquilino AND i.autorizado=TRUE) unidad
        ON unidad.id_casa=s.id_casa
     WHERE unidad.id_usuario=? AND s.estado='PENDIENTE' LIMIT 1 FOR UPDATE`, [userId],
  );
  if (rows[0]) {
    const error = new Error(`Reserva bloqueada por sancion vigente: ${rows[0].motivo}`);
    error.status = 403; error.code = "ACTIVE_SANCTION"; throw error;
  }
}

function normalizeReservationPayload(payload, requireUserId) {
  const normalized = {
    id_usuario: payload.id_usuario == null ? null : Number(payload.id_usuario),
    id_amenidad: ensurePositiveInteger(payload.id_amenidad, "id_amenidad"),
    fecha: ensureValidDate(payload.fecha),
    hora_inicio: ensureValidTime(payload.hora_inicio, "hora de inicio"),
    hora_fin: ensureValidTime(payload.hora_fin, "hora de fin"),
  };

  if (requireUserId) {
    normalized.id_usuario = ensurePositiveInteger(payload.id_usuario, "id_usuario");
  }

  return normalized;
}

async function listAmenities() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);

    const [rows] = await connection.execute(`
      SELECT
        id_amenidad,
        nombre,
        COALESCE(descripcion, '') AS descripcion,
        TIME_FORMAT(hora_apertura, '%H:%i') AS hora_apertura,
        TIME_FORMAT(hora_cierre, '%H:%i') AS hora_cierre,
        intervalo_minutos,
        activo
      FROM AMENIDAD
      ORDER BY id_amenidad ASC
    `);

    await connection.commit();
    return rows.map(mapAmenity);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listReservableUsers() {
  const rows = await query(
    `
      SELECT
        u.id_usuario,
        u.nombre,
        tu.nombre AS rol,
        COALESCE(unidad.unidad, 'Sin unidad') AS unidad
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
        ON unidad.id_usuario = u.id_usuario
      WHERE u.activo = 1
        AND tu.nombre IN ('residente', 'inquilino')
      ORDER BY u.nombre ASC
    `,
  );

  return rows.map((row) => ({
    id_usuario: Number(row.id_usuario),
    nombre: row.nombre,
    rol: row.rol,
    unidad: row.unidad || "Sin unidad",
  }));
}

async function listReservationsByRange(fromDate, toDate, options = {}) {
  const from = ensureValidDate(fromDate);
  const to = ensureValidDate(toDate);
  const amenityId = options.id_amenidad == null ? null : Number(options.id_amenidad);
  const userId = options.id_usuario == null ? null : Number(options.id_usuario);
  const includeUserDetails = Boolean(options.includeUserDetails);
  const estado = normalizeString(options.estado).toUpperCase();
  const unidad = normalizeString(options.unidad).toLowerCase();
  if (estado && !["PENDIENTE", "CONFIRMADA", "CANCELADA"].includes(estado)) {
    const error = new Error("El estado de reserva es invalido."); error.status = 400; throw error;
  }

  if (from > to) {
    const error = new Error("El rango de fechas es invalido.");
    error.status = 400;
    throw error;
  }

  if (amenityId != null && (!Number.isInteger(amenityId) || amenityId <= 0)) {
    const error = new Error("La amenidad es invalida.");
    error.status = 400;
    throw error;
  }

  if (userId != null && (!Number.isInteger(userId) || userId <= 0)) {
    const error = new Error("El usuario es invalido.");
    error.status = 400;
    throw error;
  }

  const params = [from, to];
  let filtersSql = "";

  if (amenityId != null) {
    filtersSql += " AND r.id_amenidad = ?";
    params.push(amenityId);
  }

  if (userId != null) {
    filtersSql += " AND r.id_usuario = ?";
    params.push(userId);
  }
  if (estado) { filtersSql += " AND COALESCE(r.estado, 'CONFIRMADA') = ?"; params.push(estado); }
  if (unidad) { filtersSql += " AND LOWER(COALESCE(unidad.unidad, 'Sin unidad')) LIKE ?"; params.push(`%${unidad}%`); }

  const rows = await query(
    `
      SELECT
        r.id_usuario,
        r.id_amenidad,
        a.nombre AS amenidad_nombre,
        DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(r.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(r.hora_fin, '%H:%i') AS hora_fin,
        COALESCE(r.estado, 'CONFIRMADA') AS estado,
        u.nombre AS usuario_nombre,
        tu.nombre AS usuario_rol,
        COALESCE(unidad.unidad, 'Sin unidad') AS unidad
      FROM RESERVA r
      INNER JOIN AMENIDAD a
        ON a.id_amenidad = r.id_amenidad
      INNER JOIN USUARIO u
        ON u.id_usuario = r.id_usuario
      INNER JOIN TIPO_USUARIO tu
        ON tu.id_tipo_usuario = u.id_tipo_usuario
      LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
        ON unidad.id_usuario = u.id_usuario
      WHERE r.fecha BETWEEN ? AND ?
        ${options.includeCanceled ? "" : "AND COALESCE(r.estado, 'CONFIRMADA') <> 'CANCELADA'"}
        ${filtersSql}
      ORDER BY r.fecha ASC, r.hora_inicio ASC, a.id_amenidad ASC, u.nombre ASC
    `,
    params,
  );

  return rows.map((row) => mapReservation(row, includeUserDetails));
}

async function listReservationHistory(userId) {
  const rows = await query(
    `
      SELECT
        h.id_historial,
        h.accion,
        h.detalle,
        a.nombre AS amenidad_nombre,
        DATE_FORMAT(h.fecha_anterior, '%Y-%m-%d') AS fecha_anterior,
        TIME_FORMAT(h.hora_inicio_anterior, '%H:%i') AS hora_inicio_anterior,
        TIME_FORMAT(h.hora_fin_anterior, '%H:%i') AS hora_fin_anterior,
        DATE_FORMAT(h.fecha_nueva, '%Y-%m-%d') AS fecha_nueva,
        TIME_FORMAT(h.hora_inicio_nueva, '%H:%i') AS hora_inicio_nueva,
        TIME_FORMAT(h.hora_fin_nueva, '%H:%i') AS hora_fin_nueva,
        h.estado_anterior,
        h.estado_nuevo,
        h.realizado_por_nombre,
        DATE_FORMAT(h.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en
      FROM HISTORIAL_RESERVA h
      INNER JOIN AMENIDAD a
        ON a.id_amenidad = h.id_amenidad
      WHERE h.id_usuario = ?
      ORDER BY h.creado_en DESC, h.id_historial DESC
      LIMIT 20
    `,
    [userId],
  );

  return rows.map((row) => ({
    id_historial: Number(row.id_historial),
    accion: row.accion,
    detalle: row.detalle,
    amenidad_nombre: row.amenidad_nombre,
    fecha_anterior: row.fecha_anterior,
    hora_inicio_anterior: row.hora_inicio_anterior,
    hora_fin_anterior: row.hora_fin_anterior,
    fecha_nueva: row.fecha_nueva,
    hora_inicio_nueva: row.hora_inicio_nueva,
    hora_fin_nueva: row.hora_fin_nueva,
    estado_anterior: row.estado_anterior,
    estado_nuevo: row.estado_nuevo,
    realizado_por_nombre: row.realizado_por_nombre,
    creado_en: row.creado_en,
  }));
}

async function updateAmenityReservation(viewer, reservationKey, payload = {}) {
  const key = parseReservationKey(reservationKey);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);
    const current = await getReservationForChange(connection, key, viewer, true);
    assertReservationChangeAllowed(current);

    const next = normalizeReservationPayload(
      {
        id_usuario: current.id_usuario,
        id_amenidad: payload.id_amenidad || current.id_amenidad,
        fecha: payload.fecha || current.fecha,
        hora_inicio: payload.hora_inicio || current.hora_inicio,
        hora_fin: payload.hora_fin || current.hora_fin,
      },
      true,
    );
    const amenity = await getAmenityRecord(connection, next.id_amenidad);
    validateReservationRange(amenity, next.fecha, next.hora_inicio, next.hora_fin);

    const conflict = await findReservationConflict(
      connection,
      next.id_amenidad,
      next.fecha,
      next.hora_inicio,
      next.hora_fin,
      true,
    );

    if (
      conflict &&
      !(
        Number(conflict.id_usuario) === Number(current.id_usuario) &&
        Number(conflict.id_amenidad) === Number(current.id_amenidad) &&
        conflict.fecha === current.fecha &&
        conflict.hora_inicio === current.hora_inicio
      )
    ) {
      const error = new Error("El nuevo horario ya esta ocupado para esta amenidad.");
      error.status = 409;
      throw error;
    }

    await connection.execute(
      `
        UPDATE RESERVA
        SET
          id_amenidad = ?,
          fecha = ?,
          hora_inicio = ?,
          hora_fin = ?,
          estado = 'CONFIRMADA'
        WHERE id_usuario = ?
          AND id_amenidad = ?
          AND fecha = ?
          AND hora_inicio = ?
      `,
      [
        next.id_amenidad,
        next.fecha,
        next.hora_inicio,
        next.hora_fin,
        current.id_usuario,
        current.id_amenidad,
        current.fecha,
        `${current.hora_inicio}:00`,
      ],
    );

    const viewerName = await getUserName(connection, viewer.id);
    await insertReservationHistory(
      connection,
      current,
      {
        fecha: next.fecha,
        hora_inicio: next.hora_inicio,
        hora_fin: next.hora_fin,
        estado: "CONFIRMADA",
      },
      "MODIFICACION",
      { id: viewer.id, nombre: viewerName },
    );

    await connection.commit();

    const updatedRows = await listReservationsByRange(next.fecha, next.fecha, {
      id_amenidad: next.id_amenidad,
      id_usuario: current.id_usuario,
      includeUserDetails: false,
    });
    return updatedRows.find((item) => item.hora_inicio === next.hora_inicio.slice(0, 5)) || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelAmenityReservation(viewer, reservationKey) {
  const key = parseReservationKey(reservationKey);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const current = await getReservationForChange(connection, key, viewer, true);
    assertReservationChangeAllowed(current);

    await connection.execute(
      `
        UPDATE RESERVA
        SET estado = 'CANCELADA'
        WHERE id_usuario = ?
          AND id_amenidad = ?
          AND fecha = ?
          AND hora_inicio = ?
      `,
      [current.id_usuario, current.id_amenidad, current.fecha, `${current.hora_inicio}:00`],
    );

    const viewerName = await getUserName(connection, viewer.id);
    await insertReservationHistory(
      connection,
      current,
      { ...current, estado: "CANCELADA" },
      "CANCELACION",
      { id: viewer.id, nombre: viewerName },
    );

    await connection.commit();
    return mapReservation({ ...current, estado: "CANCELADA" }, false);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAmenityStats(fromDate, toDate, filters = {}) {
  const from = ensureValidDate(fromDate);
  const to = ensureValidDate(toDate);
  const amenityId = filters.id_amenidad == null ? null : Number(filters.id_amenidad);
  const params = [from, to];
  let amenityFilter = "";

  if (amenityId && Number.isInteger(amenityId) && amenityId > 0) {
    amenityFilter = " AND a.id_amenidad = ?";
    params.push(amenityId);
  }

  const rows = await query(
    `
      SELECT
        a.id_amenidad,
        a.nombre,
        COUNT(r.id_usuario) AS total_reservas,
        SUM(CASE WHEN COALESCE(r.estado, 'CONFIRMADA') = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN COALESCE(r.estado, 'CONFIRMADA') <> 'CANCELADA' THEN 1 ELSE 0 END) AS activas
      FROM AMENIDAD a
      LEFT JOIN RESERVA r
        ON r.id_amenidad = a.id_amenidad
        AND r.fecha BETWEEN ? AND ?
      WHERE a.activo = TRUE
        ${amenityFilter}
      GROUP BY a.id_amenidad, a.nombre
      ORDER BY activas DESC, total_reservas DESC, a.nombre ASC
    `,
    params,
  );

  const byAmenity = rows.map((row, index) => ({
    id_amenidad: Number(row.id_amenidad),
    nombre: row.nombre,
    activas: Number(row.activas || 0),
    canceladas: Number(row.canceladas || 0),
    total_reservas: Number(row.activas || 0) + Number(row.canceladas || 0),
    ranking: index + 1,
  }));

  return {
    from,
    to,
    total_reservas: byAmenity.reduce((total, item) => total + item.total_reservas, 0),
    reservas_activas: byAmenity.reduce((total, item) => total + item.activas, 0),
    reservas_canceladas: byAmenity.reduce((total, item) => total + item.canceladas, 0),
    por_amenidad: byAmenity,
    ranking: byAmenity.filter((item) => item.total_reservas > 0),
  };
}

async function getAmenityAvailability(amenityIdValue, fechaValue, options = {}) {
  const amenityId = ensurePositiveInteger(amenityIdValue, "id_amenidad");
  const fecha = ensureValidDate(fechaValue);
  const includeUserDetails = Boolean(options.includeUserDetails);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);
    const amenity = await getAmenityRecord(connection, amenityId);

    const [reservationRows] = await connection.execute(
      `
        SELECT
          r.id_usuario,
          r.id_amenidad,
          a.nombre AS amenidad_nombre,
          DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha,
          TIME_FORMAT(r.hora_inicio, '%H:%i') AS hora_inicio,
          TIME_FORMAT(r.hora_fin, '%H:%i') AS hora_fin,
          COALESCE(r.estado, 'CONFIRMADA') AS estado,
          u.nombre AS usuario_nombre,
          tu.nombre AS usuario_rol,
          COALESCE(unidad.unidad, 'Sin unidad') AS unidad
        FROM RESERVA r
        INNER JOIN AMENIDAD a
          ON a.id_amenidad = r.id_amenidad
        INNER JOIN USUARIO u
          ON u.id_usuario = r.id_usuario
        INNER JOIN TIPO_USUARIO tu
          ON tu.id_tipo_usuario = u.id_tipo_usuario
        LEFT JOIN (${USER_UNIT_SUBQUERY}) unidad
          ON unidad.id_usuario = u.id_usuario
        WHERE r.id_amenidad = ?
          AND r.fecha = ?
          AND COALESCE(r.estado, 'CONFIRMADA') <> 'CANCELADA'
        ORDER BY r.hora_inicio ASC
      `,
      [amenityId, fecha],
    );

    const reservations = reservationRows.map((row) => mapReservation(row, includeUserDetails));
    const slots = buildSlots(
      amenity.hora_apertura,
      amenity.hora_cierre,
      amenity.intervalo_minutos,
    ).map((slot) => {
      const conflictingReservation =
        reservations.find(
          (reservation) =>
            reservation.hora_inicio < slot.hora_fin && reservation.hora_fin > slot.hora_inicio,
        ) || null;

      return {
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        disponible: amenity.activo && !conflictingReservation,
        reserva: conflictingReservation,
      };
    });

    await connection.commit();

    return {
      amenidad: amenity,
      fecha,
      slots,
      reservas: reservations,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function composeUnifiedAvailability(amenities, fecha, availabilityLoader) {
  const activeAmenities = amenities.filter((amenity) => amenity.activo);
  const amenidades = await Promise.all(
    activeAmenities.map((amenity) => availabilityLoader(amenity.id_amenidad, fecha)),
  );

  return { fecha, amenidades };
}

async function getUnifiedAmenityAvailability(fechaValue) {
  const fecha = ensureValidDate(fechaValue);
  const amenities = await listAmenities();

  return composeUnifiedAvailability(amenities, fecha, (amenityId, selectedDate) =>
    getAmenityAvailability(amenityId, selectedDate, { includeUserDetails: false }),
  );
}

async function validateAmenityReservationConflict(payload, options = {}) {
  const normalizedPayload = normalizeReservationPayload(payload, Boolean(options.requireUserId));
  const includeUserDetails = Boolean(options.includeUserDetails);
  const shouldValidateLimit = Boolean(options.validateUserLimit) || normalizedPayload.id_usuario != null;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);
    const amenity = await getAmenityRecord(connection, normalizedPayload.id_amenidad);

    validateReservationRange(
      amenity,
      normalizedPayload.fecha,
      normalizedPayload.hora_inicio,
      normalizedPayload.hora_fin,
    );

    const conflictingReservation = await findReservationConflict(
      connection,
      normalizedPayload.id_amenidad,
      normalizedPayload.fecha,
      normalizedPayload.hora_inicio,
      normalizedPayload.hora_fin,
      false,
    );
    const limitStatus =
      shouldValidateLimit && normalizedPayload.id_usuario != null
        ? await getReservationLimitStatus(connection, normalizedPayload.id_usuario, false)
        : null;

    await connection.commit();

    return {
      conflicto: Boolean(conflictingReservation),
      reserva: conflictingReservation
        ? mapReservation(conflictingReservation, includeUserDetails)
        : null,
      limite_alcanzado: Boolean(limitStatus?.limite_alcanzado),
      limite_reservas: limitStatus?.limite ?? MAX_ACTIVE_RESERVATIONS_PER_USER,
      reservas_activas_usuario: limitStatus?.reservas_activas ?? null,
      mensaje_limite: limitStatus?.limite_alcanzado ? RESERVATION_LIMIT_MESSAGE : null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createAmenityReservation(viewer, payload) {
  const normalizedViewer = {
    role: normalizeString(viewer?.role).toLowerCase(),
    id: viewer?.id == null ? null : Number(viewer.id),
  };
  const isAdmin = normalizedViewer.role === "admin";
  const normalizedPayload = normalizeReservationPayload(payload, isAdmin);
  const userId = isAdmin
    ? normalizedPayload.id_usuario
    : ensurePositiveInteger(normalizedViewer.id, "id_usuario");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);

    const reservableUser = await getReservableUserRecord(connection, userId);
    await assertNoActiveAmenitySanction(connection, userId);
    const amenity = await getAmenityRecord(connection, normalizedPayload.id_amenidad);

    validateReservationRange(
      amenity,
      normalizedPayload.fecha,
      normalizedPayload.hora_inicio,
      normalizedPayload.hora_fin,
    );

    const conflictingReservation = await findReservationConflict(
      connection,
      normalizedPayload.id_amenidad,
      normalizedPayload.fecha,
      normalizedPayload.hora_inicio,
      normalizedPayload.hora_fin,
      true,
    );

    if (conflictingReservation) {
      const error = new Error("El horario seleccionado ya esta ocupado para esta amenidad.");
      error.status = 409;
      throw error;
    }

    const limitStatus = await getReservationLimitStatus(connection, userId, true);

    if (limitStatus.limite_alcanzado) {
      throwReservationLimitError();
    }

    await connection.execute(
      `
        INSERT INTO RESERVA (
          id_usuario,
          id_amenidad,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          creado_en
        )
        VALUES (?, ?, ?, ?, ?, 'CONFIRMADA', NOW())
      `,
      [
        userId,
        normalizedPayload.id_amenidad,
        normalizedPayload.fecha,
        normalizedPayload.hora_inicio,
        normalizedPayload.hora_fin,
      ],
    );

    await connection.commit();

    return {
      reservation_key: createReservationKey({
        id_usuario: userId,
        id_amenidad: normalizedPayload.id_amenidad,
        fecha: normalizedPayload.fecha,
        hora_inicio: normalizedPayload.hora_inicio.slice(0, 5),
      }),
      id_usuario: userId,
      id_amenidad: normalizedPayload.id_amenidad,
      amenidad_nombre: amenity.nombre,
      fecha: normalizedPayload.fecha,
      hora_inicio: normalizedPayload.hora_inicio.slice(0, 5),
      hora_fin: normalizedPayload.hora_fin.slice(0, 5),
      estado: "CONFIRMADA",
      estado_actual: getCurrentReservationStatus({
        fecha: normalizedPayload.fecha,
        hora_inicio: normalizedPayload.hora_inicio.slice(0, 5),
        hora_fin: normalizedPayload.hora_fin.slice(0, 5),
        estado: "CONFIRMADA",
      }),
      usuario_nombre: reservableUser.nombre,
      usuario_rol: reservableUser.rol,
      unidad: reservableUser.unidad,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAmenitySchedule(amenityIdValue, payload) {
  const amenityId = ensurePositiveInteger(amenityIdValue, "id_amenidad");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureAmenityCatalog(connection);

    const currentAmenity = await getAmenityRecord(connection, amenityId);
    const horaApertura = ensureValidTime(
      payload.hora_apertura || currentAmenity.hora_apertura,
      "hora de apertura",
    );
    const horaCierre = ensureValidTime(
      payload.hora_cierre || currentAmenity.hora_cierre,
      "hora de cierre",
    );
    const intervaloMinutos =
      payload.intervalo_minutos == null
        ? currentAmenity.intervalo_minutos
        : ensureValidInterval(payload.intervalo_minutos);
    const activo = ensureBoolean(payload.activo, currentAmenity.activo);
    const descripcion = normalizeString(payload.descripcion || currentAmenity.descripcion);

    if (horaApertura >= horaCierre) {
      const error = new Error("La hora de cierre debe ser mayor a la hora de apertura.");
      error.status = 400;
      throw error;
    }

    const openingMinutes = toMinutes(horaApertura);
    const closingMinutes = toMinutes(horaCierre);

    if (closingMinutes - openingMinutes < intervaloMinutos) {
      const error = new Error("El horario configurado no deja espacio suficiente para el intervalo.");
      error.status = 400;
      throw error;
    }

    if ((closingMinutes - openingMinutes) % intervaloMinutos !== 0) {
      const error = new Error("La ventana operativa debe ser divisible por el intervalo configurado.");
      error.status = 400;
      throw error;
    }

    const currentDateTime = getCurrentDateTimeInTimezone();
    const [futureConflicts] = await connection.execute(
      `
        SELECT
          DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
          TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
          TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
        FROM RESERVA
        WHERE id_amenidad = ?
          AND fecha >= ?
          AND COALESCE(estado, 'CONFIRMADA') <> 'CANCELADA'
          AND (hora_inicio < ? OR hora_fin > ?)
        ORDER BY fecha ASC, hora_inicio ASC
        LIMIT 1
        FOR UPDATE
      `,
      [amenityId, currentDateTime.date, horaApertura, horaCierre],
    );

    if (futureConflicts.length > 0) {
      const error = new Error(
        "Existe al menos una reserva futura fuera del nuevo horario configurado para esta amenidad.",
      );
      error.status = 409;
      throw error;
    }

    await connection.execute(
      `
        UPDATE AMENIDAD
        SET
          descripcion = ?,
          hora_apertura = ?,
          hora_cierre = ?,
          intervalo_minutos = ?,
          activo = ?
        WHERE id_amenidad = ?
      `,
      [
        descripcion || null,
        horaApertura,
        horaCierre,
        intervaloMinutos,
        activo ? 1 : 0,
        amenityId,
      ],
    );

    await connection.commit();

    const updatedAmenity = await listAmenities();
    return updatedAmenity.find((item) => item.id_amenidad === amenityId) || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  MAX_ACTIVE_RESERVATIONS_PER_USER,
  RESERVATION_LIMIT_MESSAGE,
  listAmenities,
  listReservableUsers,
  listReservationsByRange,
  listReservationHistory,
  getAmenityAvailability,
  getUnifiedAmenityAvailability,
  validateAmenityReservationConflict,
  createAmenityReservation,
  updateAmenityReservation,
  cancelAmenityReservation,
  getAmenityStats,
  updateAmenitySchedule,
  __private__: {
    composeUnifiedAvailability,
    countActiveReservationsByUser,
    getReservationLimitStatus,
    throwReservationLimitError,
    assertNoActiveAmenitySanction,
  },
};
