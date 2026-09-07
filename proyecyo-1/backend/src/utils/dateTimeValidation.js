const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function ensureValidDate(value, fieldName = "fecha") {
  const normalized = String(value ?? "").trim();
  const match = DATE_PATTERN.exec(normalized);
  if (!match) throw invalid(`La ${fieldName} es obligatoria y debe tener formato YYYY-MM-DD.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw invalid(`La ${fieldName} no es una fecha valida.`);
  }
  return normalized;
}

function ensureValidTime(value, fieldName = "hora") {
  const normalized = String(value ?? "").trim();
  const match = TIME_PATTERN.exec(normalized);
  if (!match) throw invalid(`La ${fieldName} es obligatoria y debe tener formato HH:MM.`);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw invalid(`La ${fieldName} no es una hora valida.`);
  }
  return `${match[1]}:${match[2]}:${String(seconds).padStart(2, "0")}`;
}

function ensureValidDateRange(desdeValue, hastaValue) {
  const desde = ensureValidDate(desdeValue, "fecha inicial");
  const hasta = ensureValidDate(hastaValue, "fecha final");
  if (desde > hasta) throw invalid("La fecha inicial no puede ser posterior a la fecha final.");
  return { desde, hasta };
}

function ensureValidTimeRange(inicioValue, finValue) {
  const inicio = ensureValidTime(inicioValue, "hora de inicio");
  const fin = ensureValidTime(finValue, "hora de fin");
  if (inicio >= fin) throw invalid("La hora de fin debe ser mayor a la hora de inicio.");
  return { inicio, fin };
}

module.exports = { ensureValidDate, ensureValidTime, ensureValidDateRange, ensureValidTimeRange };
