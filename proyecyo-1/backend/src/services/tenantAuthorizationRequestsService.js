const { pool, query } = require("../database/mysql");

// Estados reales de SOLICITUD_AUTORIZACION_DIGITAL (contrato existente del frontend).
const DECISIONS = new Set(["APROBADO", "RECHAZADO"]);
const LIST_STATUSES = new Set(["PENDIENTE", "APROBADO", "RECHAZADO"]);
const MAX_RESPONSE_LENGTH = 255;

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// El propietario se deriva siempre de CASA -> RESIDENTE -> USUARIO; nunca de un id
// enviado por el cliente ni solo del id_propietario_usuario guardado al crear.
const OWNED_HOUSE_JOIN = `
  INNER JOIN CASA c ON c.id_casa = s.id_casa
  INNER JOIN RESIDENTE r ON r.id_residente = c.id_residente`;

function mapRequest(row) {
  return {
    id_solicitud: Number(row.id_solicitud),
    accion: row.accion,
    motivo: row.motivo,
    estado: row.estado,
    respuesta: row.respuesta || null,
    inquilino: row.inquilino || null,
    unidad: row.unidad || null,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

/** Solicitudes de inquilinos de las unidades del residente autenticado. */
async function listOwnerAuthorizationRequests(ownerUserId, filters = {}) {
  const status = String(filters.estado || "PENDIENTE").toUpperCase();
  const params = [ownerUserId];
  let statusSql = "";
  if (status !== "TODAS") {
    if (!LIST_STATUSES.has(status)) throw httpError("El estado de solicitud es invalido.", 400);
    statusSql = " AND s.estado = ?";
    params.push(status);
  }

  const rows = await query(
    `
      SELECT
        s.id_solicitud,
        s.accion,
        s.motivo,
        s.estado,
        s.respuesta,
        inquilino.nombre AS inquilino,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS unidad,
        DATE_FORMAT(s.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,
        DATE_FORMAT(s.actualizado_en, '%Y-%m-%d %H:%i:%s') AS actualizado_en
      FROM SOLICITUD_AUTORIZACION_DIGITAL s
      ${OWNED_HOUSE_JOIN}
      INNER JOIN USUARIO inquilino ON inquilino.id_usuario = s.id_inquilino_usuario
      WHERE r.id_usuario = ?${statusSql}
      ORDER BY (s.estado = 'PENDIENTE') DESC, s.creado_en DESC, s.id_solicitud DESC
      LIMIT 50
    `,
    params,
  );
  return rows.map(mapRequest);
}

/**
 * Aprueba o rechaza una solicitud PENDIENTE de una unidad del residente.
 * Transaccional: bloquea la fila, valida propietario y estado, y notifica al
 * inquilino con NOTIFICACION (no es un evento financiero: no usa el outbox HU19).
 */
async function resolveOwnerAuthorizationRequest(ownerUserId, requestIdInput, payload = {}) {
  const requestId = Number(requestIdInput);
  if (!Number.isInteger(requestId) || requestId <= 0) throw httpError("La solicitud es invalida.", 400);
  const decision = String(payload.decision || "").toUpperCase();
  if (!DECISIONS.has(decision)) throw httpError("La decision debe ser APROBADO o RECHAZADO.", 400);
  const response = String(payload.respuesta ?? "").trim();
  if (response.length > MAX_RESPONSE_LENGTH) throw httpError("La respuesta no puede superar 255 caracteres.", 400);
  if (decision === "RECHAZADO" && !response) throw httpError("Indique el motivo del rechazo.", 400);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `
        SELECT s.id_solicitud, s.estado, s.accion, s.id_inquilino_usuario
        FROM SOLICITUD_AUTORIZACION_DIGITAL s
        ${OWNED_HOUSE_JOIN}
        WHERE s.id_solicitud = ? AND r.id_usuario = ?
        LIMIT 1
        FOR UPDATE
      `,
      [requestId, ownerUserId],
    );
    const current = rows[0];
    // Mismo 404 para inexistente o ajena: no se revela si existe en otra unidad.
    if (!current) throw httpError("No se encontro la solicitud en sus unidades.", 404);
    if (current.estado !== "PENDIENTE") throw httpError("La solicitud ya fue resuelta.", 409);

    const [update] = await connection.execute(
      `
        UPDATE SOLICITUD_AUTORIZACION_DIGITAL
        SET estado = ?, respuesta = ?, actualizado_en = CURRENT_TIMESTAMP
        WHERE id_solicitud = ? AND estado = 'PENDIENTE'
      `,
      [decision, response || null, requestId],
    );
    if (Number(update.affectedRows) !== 1) throw httpError("La solicitud ya fue resuelta.", 409);

    const approved = decision === "APROBADO";
    await connection.execute(
      `
        INSERT INTO NOTIFICACION (id_usuario, tipo, titulo, mensaje, leido)
        VALUES (?, 'SOLICITUD_AUTORIZACION', ?, ?, FALSE)
      `,
      [
        current.id_inquilino_usuario,
        approved ? "Solicitud aprobada" : "Solicitud rechazada",
        `Su solicitud "${current.accion}" fue ${approved ? "aprobada" : "rechazada"} por el propietario.${response ? ` Respuesta: ${response}` : ""}`,
      ],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [updated] = await query(
    `
      SELECT s.id_solicitud, s.accion, s.motivo, s.estado, s.respuesta, inquilino.nombre AS inquilino,
        CONCAT(COALESCE(c.torre, ''), CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END, c.numero) AS unidad,
        DATE_FORMAT(s.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,
        DATE_FORMAT(s.actualizado_en, '%Y-%m-%d %H:%i:%s') AS actualizado_en
      FROM SOLICITUD_AUTORIZACION_DIGITAL s
      ${OWNED_HOUSE_JOIN}
      INNER JOIN USUARIO inquilino ON inquilino.id_usuario = s.id_inquilino_usuario
      WHERE s.id_solicitud = ? AND r.id_usuario = ?
      LIMIT 1
    `,
    [requestId, ownerUserId],
  );
  return mapRequest(updated);
}

module.exports = { listOwnerAuthorizationRequests, resolveOwnerAuthorizationRequest };
