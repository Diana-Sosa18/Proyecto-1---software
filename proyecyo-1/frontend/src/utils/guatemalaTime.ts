// Zona horaria operativa del residencial. El backend guarda instantes en UTC
// (NOW()/CURRENT_TIMESTAMP) y los devuelve como "YYYY-MM-DD HH:mm:ss" sin zona.
export const GUATEMALA_TIMEZONE = "America/Guatemala";

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GUATEMALA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

/**
 * Fecha calendario de Guatemala (YYYY-MM-DD). Reemplaza a
 * `new Date().toISOString().slice(0, 10)`, que devuelve el dia UTC
 * (despues de las 18:00 en Guatemala ya es "manana").
 */
export function guatemalaToday(offsetDays = 0, now: Date = new Date()) {
  const values = dateParts(now);
  if (!offsetDays) return `${values.year}-${values.month}-${values.day}`;
  // Suma dias sobre la fecha calendario local (mediodia UTC evita saltos de dia).
  const base = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

/** Interpreta un timestamp del backend guardado en UTC ("YYYY-MM-DD HH:mm:ss" o ISO). */
export function parseUtcTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(normalized);
  const date = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Muestra un instante UTC del backend en hora de Guatemala. */
export function formatUtcTimestamp(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  const date = parseUtcTimestamp(value);
  if (!date) return value ?? "";
  return new Intl.DateTimeFormat("es-GT", { ...options, timeZone: GUATEMALA_TIMEZONE }).format(date);
}
