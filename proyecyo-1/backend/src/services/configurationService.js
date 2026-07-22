const { pool, query } = require("../database/mysql");

const CONFIG_KEYS = {
  HORA_APERTURA: "visitas_hora_apertura",
  HORA_CIERRE: "visitas_hora_cierre",
  DURACION_MAXIMA_HORAS: "visitas_duracion_maxima_horas",
  ACTIVO: "visitas_activo",
};

const DEFAULT_VISIT_SCHEDULE = {
  hora_apertura: "06:00",
  hora_cierre: "22:00",
  duracion_maxima_horas: 4,
  activo: true,
};

function normalizeString(value) {
  return String(value || "").trim();
}

function ensureValidTime(value, fieldName) {
  const normalized = normalizeString(value);

  if (!/^\d{2}:\d{2}$/.test(normalized) && !/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    const error = new Error(`La ${fieldName} es obligatoria y debe tener formato HH:MM.`);
    error.status = 400;
    throw error;
  }

  return normalized.length === 5 ? normalized : normalized.slice(0, 5);
}

function toMinutes(time) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
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

function ensureValidDurationHours(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    const error = new Error("La duracion maxima debe ser un entero entre 1 y 12 horas.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

async function getConfigMap() {
  const rows = await query(
    `
      SELECT clave, valor
      FROM CONFIGURACION
      WHERE clave IN (?, ?, ?, ?)
    `,
    [
      CONFIG_KEYS.HORA_APERTURA,
      CONFIG_KEYS.HORA_CIERRE,
      CONFIG_KEYS.DURACION_MAXIMA_HORAS,
      CONFIG_KEYS.ACTIVO,
    ],
  );

  return Object.fromEntries(rows.map((row) => [row.clave, row.valor]));
}

function mapVisitScheduleConfig(configMap) {
  return {
    hora_apertura: ensureValidTime(
      configMap[CONFIG_KEYS.HORA_APERTURA] || DEFAULT_VISIT_SCHEDULE.hora_apertura,
      "hora de apertura",
    ),
    hora_cierre: ensureValidTime(
      configMap[CONFIG_KEYS.HORA_CIERRE] || DEFAULT_VISIT_SCHEDULE.hora_cierre,
      "hora de cierre",
    ),
    duracion_maxima_horas: ensureValidDurationHours(
      configMap[CONFIG_KEYS.DURACION_MAXIMA_HORAS] ?? DEFAULT_VISIT_SCHEDULE.duracion_maxima_horas,
    ),
    activo: ensureBoolean(
      configMap[CONFIG_KEYS.ACTIVO],
      DEFAULT_VISIT_SCHEDULE.activo,
    ),
  };
}

function validateVisitSchedulePayload(payload) {
  const horaApertura = ensureValidTime(
    payload.hora_apertura ?? DEFAULT_VISIT_SCHEDULE.hora_apertura,
    "hora de apertura",
  );
  const horaCierre = ensureValidTime(
    payload.hora_cierre ?? DEFAULT_VISIT_SCHEDULE.hora_cierre,
    "hora de cierre",
  );
  const duracionMaximaHoras = ensureValidDurationHours(
    payload.duracion_maxima_horas ?? DEFAULT_VISIT_SCHEDULE.duracion_maxima_horas,
  );
  const activo = ensureBoolean(payload.activo, DEFAULT_VISIT_SCHEDULE.activo);

  if (horaApertura >= horaCierre) {
    const error = new Error("La hora de cierre debe ser mayor a la hora de apertura.");
    error.status = 400;
    throw error;
  }

  const windowMinutes = toMinutes(horaCierre) - toMinutes(horaApertura);

  if (windowMinutes < duracionMaximaHoras * 60) {
    const error = new Error(
      "La duracion maxima no puede ser mayor al rango horario permitido para visitas.",
    );
    error.status = 400;
    throw error;
  }

  return {
    hora_apertura: horaApertura,
    hora_cierre: horaCierre,
    duracion_maxima_horas: duracionMaximaHoras,
    activo,
  };
}

async function getVisitScheduleConfig() {
  const configMap = await getConfigMap();
  return mapVisitScheduleConfig(configMap);
}

async function updateVisitScheduleConfig(payload) {
  const validated = validateVisitSchedulePayload(payload);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const entries = [
      [CONFIG_KEYS.HORA_APERTURA, validated.hora_apertura],
      [CONFIG_KEYS.HORA_CIERRE, validated.hora_cierre],
      [CONFIG_KEYS.DURACION_MAXIMA_HORAS, String(validated.duracion_maxima_horas)],
      [CONFIG_KEYS.ACTIVO, validated.activo ? "true" : "false"],
    ];

    for (const [clave, valor] of entries) {
      await connection.execute(
        `
          INSERT INTO CONFIGURACION (clave, valor)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE valor = VALUES(valor)
        `,
        [clave, valor],
      );
    }

    await connection.commit();
    return validated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function validateVisitTimesAgainstSchedule(horaInicio, horaFin, schedule) {
  if (!schedule.activo) {
    const error = new Error("Las autorizaciones de visita estan temporalmente deshabilitadas.");
    error.status = 403;
    throw error;
  }

  const startMinutes = toMinutes(horaInicio);
  const endMinutes = toMinutes(horaFin);
  const openingMinutes = toMinutes(schedule.hora_apertura);
  const closingMinutes = toMinutes(schedule.hora_cierre);
  const maxDurationMinutes = schedule.duracion_maxima_horas * 60;

  if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
    const error = new Error(
      `El horario debe estar entre ${schedule.hora_apertura} y ${schedule.hora_cierre}.`,
    );
    error.status = 400;
    throw error;
  }

  if (endMinutes - startMinutes > maxDurationMinutes) {
    const error = new Error(
      `La visita no puede durar mas de ${schedule.duracion_maxima_horas} hora(s).`,
    );
    error.status = 400;
    throw error;
  }
}

async function assertVisitTimesAllowed(horaInicio, horaFin) {
  const schedule = await getVisitScheduleConfig();
  validateVisitTimesAgainstSchedule(horaInicio, horaFin, schedule);
  return schedule;
}

module.exports = {
  getVisitScheduleConfig,
  updateVisitScheduleConfig,
  assertVisitTimesAllowed,
  validateVisitTimesAgainstSchedule,
  validateVisitSchedulePayload,
  DEFAULT_VISIT_SCHEDULE,
  CONFIG_KEYS,
};
