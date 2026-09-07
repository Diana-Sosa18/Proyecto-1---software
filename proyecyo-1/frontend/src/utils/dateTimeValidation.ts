const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isValidDate(value: string) {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isValidTime(value: string) {
  const match = TIME_PATTERN.exec(value.trim());
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59 && Number(match[3] ?? 0) <= 59);
}

export function validateDateRange(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return "Completa la fecha inicial y la fecha final.";
  if (!isValidDate(desde)) return "La fecha inicial no es valida.";
  if (!isValidDate(hasta)) return "La fecha final no es valida.";
  return desde > hasta ? "La fecha inicial no puede ser posterior a la fecha final." : null;
}

export function validateTimeRange(inicio: string, fin: string): string | null {
  if (!inicio || !fin) return "Completa la hora de inicio y la hora de fin.";
  if (!isValidTime(inicio) || !isValidTime(fin)) return "Ingresa horas validas en formato HH:MM.";
  return inicio >= fin ? "La hora de fin debe ser mayor a la hora de inicio." : null;
}
