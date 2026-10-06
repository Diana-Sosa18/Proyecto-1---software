// Zona horaria operativa del residencial.
//
// MySQL y el contenedor del backend corren en UTC: CURTIME()/NOW()/CURRENT_TIMESTAMP
// guardan instantes UTC. Esos historicos NO se migran; se convierten al leer.
// Guatemala no usa horario de verano: el desfase es fijo (UTC-6).
const GUATEMALA_TIMEZONE = "America/Guatemala";
const GUATEMALA_UTC_OFFSET = "-06:00";

function partsInGuatemala(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GUATEMALA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

/** Fecha calendario de Guatemala (YYYY-MM-DD) para un instante dado. */
function guatemalaToday(now = new Date()) {
  const values = partsInGuatemala(now);
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Literal SQL con la fecha de hoy en Guatemala, para reemplazar CURDATE() (dia UTC)
 * dentro de subconsultas sin alterar el orden de parametros posicionales.
 * El valor lo genera el servidor y se valida estrictamente; nunca proviene del usuario.
 */
function sqlGuatemalaTodayLiteral(now = new Date()) {
  const today = guatemalaToday(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Fecha local invalida.");
  return `'${today}'`;
}

/**
 * Expresion SQL que convierte una columna TIME guardada en UTC (CURTIME())
 * a hora local de Guatemala. Solo para columnas de confianza (no input del usuario).
 */
function sqlUtcTimeToGuatemala(column) {
  return `TIME(CONVERT_TZ(TIMESTAMP('2000-01-01', ${column}), '+00:00', '${GUATEMALA_UTC_OFFSET}'))`;
}

/** Limites UTC [inicio, fin) de un dia calendario de Guatemala, para columnas DATETIME en UTC. */
function guatemalaDayRangeUtc(date) {
  const start = new Date(`${date}T00:00:00${GUATEMALA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const format = (value) => value.toISOString().slice(0, 19).replace("T", " ");
  return { start: format(start), end: format(end) };
}

module.exports = {
  GUATEMALA_TIMEZONE,
  GUATEMALA_UTC_OFFSET,
  guatemalaToday,
  sqlGuatemalaTodayLiteral,
  sqlUtcTimeToGuatemala,
  guatemalaDayRangeUtc,
};
