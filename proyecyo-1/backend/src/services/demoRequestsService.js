const { query } = require("../database/mysql");

const DEMO_STATUSES = ["NUEVA", "CONTACTADA", "DESCARTADA", "CONVERTIDA"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,24}$/;

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function httpError(message, status = 400, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function validateDemoRequest(input = {}) {
  const data = {
    nombre: clean(input.nombre),
    correo: clean(input.correo).toLowerCase(),
    telefono: clean(input.telefono),
    residencial: clean(input.residencial),
    cantidadViviendas: Number(input.cantidadViviendas),
    mensaje: clean(input.mensaje),
    aceptaContacto: input.aceptaContacto === true,
    sitioWeb: clean(input.sitioWeb),
  };

  if (data.sitioWeb) throw httpError("No fue posible procesar la solicitud.", 400, "SPAM_DETECTED");
  if (data.nombre.length < 2 || data.nombre.length > 120) throw httpError("Ingrese un nombre válido.");
  if (!EMAIL_PATTERN.test(data.correo) || data.correo.length > 160) throw httpError("Ingrese un correo válido.");
  if (!PHONE_PATTERN.test(data.telefono)) throw httpError("Ingrese un teléfono válido.");
  if (data.residencial.length < 2 || data.residencial.length > 160) throw httpError("Ingrese el nombre del residencial.");
  if (!Number.isInteger(data.cantidadViviendas) || data.cantidadViviendas < 1 || data.cantidadViviendas > 100000) {
    throw httpError("La cantidad de viviendas debe estar entre 1 y 100000.");
  }
  if (data.mensaje.length > 1000) throw httpError("El mensaje no puede superar 1000 caracteres.");
  if (!data.aceptaContacto) throw httpError("Debe aceptar el contacto para enviar la solicitud.");
  return data;
}

async function create(input) {
  const data = validateDemoRequest(input);
  const result = await query(
    `INSERT INTO SOLICITUD_DEMO
      (nombre, correo, telefono, residencial, cantidad_viviendas, mensaje, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'NUEVA')`,
    [data.nombre, data.correo, data.telefono, data.residencial, data.cantidadViviendas, data.mensaje || null],
  );
  return { id: result.insertId, message: "Solicitud recibida correctamente" };
}

function pagination(input = {}) {
  const page = Math.max(1, Number.parseInt(input.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(input.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

function adminFilters(input = {}) {
  const estado = clean(input.estado).toUpperCase();
  const desde = clean(input.desde);
  const hasta = clean(input.hasta);
  if (estado && !DEMO_STATUSES.includes(estado)) throw httpError("Estado inválido.");
  if (desde && hasta && desde > hasta) throw httpError("El rango de fechas es inválido.");
  return { estado, desde, hasta, buscar: clean(input.buscar).slice(0, 120) };
}

async function list(input = {}) {
  const { page, limit, offset } = pagination(input);
  const filters = adminFilters(input);
  const clauses = [];
  const params = [];
  if (filters.estado) { clauses.push("estado = ?"); params.push(filters.estado); }
  if (filters.desde) { clauses.push("DATE(fecha_creacion) >= ?"); params.push(filters.desde); }
  if (filters.hasta) { clauses.push("DATE(fecha_creacion) <= ?"); params.push(filters.hasta); }
  if (filters.buscar) {
    clauses.push("(nombre LIKE ? OR correo LIKE ? OR residencial LIKE ?)");
    const term = `%${filters.buscar}%`;
    params.push(term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const totals = await query(`SELECT COUNT(*) AS total FROM SOLICITUD_DEMO ${where}`, params);
  const items = await query(
    `SELECT id_solicitud AS id, nombre, correo, telefono, residencial,
      cantidad_viviendas AS cantidadViviendas, mensaje, estado,
      fecha_creacion AS fechaCreacion, fecha_actualizacion AS fechaActualizacion
     FROM SOLICITUD_DEMO ${where}
     ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { items, page, limit, total: Number(totals[0]?.total || 0) };
}

async function detail(id) {
  const rows = await query(
    `SELECT id_solicitud AS id, nombre, correo, telefono, residencial,
      cantidad_viviendas AS cantidadViviendas, mensaje, estado,
      fecha_creacion AS fechaCreacion, fecha_actualizacion AS fechaActualizacion
     FROM SOLICITUD_DEMO WHERE id_solicitud = ? LIMIT 1`,
    [Number(id)],
  );
  if (!rows[0]) throw httpError("Solicitud no encontrada.", 404);
  return rows[0];
}

async function updateStatus(id, status) {
  const estado = clean(status).toUpperCase();
  if (!DEMO_STATUSES.includes(estado)) throw httpError("Estado inválido.");
  const result = await query(
    "UPDATE SOLICITUD_DEMO SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_solicitud = ?",
    [estado, Number(id)],
  );
  if (!result.affectedRows) throw httpError("Solicitud no encontrada.", 404);
  return detail(id);
}

module.exports = { DEMO_STATUSES, validateDemoRequest, pagination, adminFilters, create, list, detail, updateStatus };
