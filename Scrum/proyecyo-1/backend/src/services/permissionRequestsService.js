const { query } = require("../database/mysql");

async function getTenantByUserId(userId) {
  const rows = await query(
    `
      SELECT id_inquilino
      FROM INQUILINO
      WHERE id_usuario = ?
      LIMIT 1
    `,
    [Number(userId)]
  );

  if (!rows[0]) {
    const error = new Error("No se encontro el inquilino asociado al usuario.");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function createPermissionRequest(userId, payload) {
  if (!userId) {
    const error = new Error("Usuario no autenticado.");
    error.status = 401;
    throw error;
  }

  const tenant = await getTenantByUserId(userId);

  const tipo_permiso = String(payload.tipo_permiso || "").trim().toUpperCase();
  const motivo = String(payload.motivo || "").trim();
  const fecha_inicio = String(payload.fecha_inicio || "").trim();
  const fecha_fin = String(payload.fecha_fin || "").trim();
  const observaciones = String(payload.observaciones || "").trim() || null;

  if (!tipo_permiso || !motivo || !fecha_inicio || !fecha_fin) {
    const error = new Error("Completa todos los campos obligatorios.");
    error.status = 400;
    throw error;
  }

  if (fecha_fin < fecha_inicio) {
    const error = new Error("La fecha de fin no puede ser menor que la fecha de inicio.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO SOLICITUD_PERMISO (
        id_inquilino,
        tipo_permiso,
        motivo,
        fecha_inicio,
        fecha_fin,
        observaciones,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')
    `,
    [tenant.id_inquilino, tipo_permiso, motivo, fecha_inicio, fecha_fin, observaciones]
  );

  const rows = await query(
    `
      SELECT
        id_solicitud_permiso,
        tipo_permiso,
        motivo,
        DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
        DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin,
        observaciones,
        estado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM SOLICITUD_PERMISO
      WHERE id_solicitud_permiso = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0];
}

async function listOwnPermissionRequests(userId) {
  if (!userId) {
    const error = new Error("Usuario no autenticado.");
    error.status = 401;
    throw error;
  }

  const tenant = await getTenantByUserId(userId);

  const rows = await query(
    `
      SELECT
        id_solicitud_permiso,
        tipo_permiso,
        motivo,
        DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
        DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin,
        observaciones,
        estado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM SOLICITUD_PERMISO
      WHERE id_inquilino = ?
      ORDER BY created_at DESC
    `,
    [tenant.id_inquilino]
  );

  return rows;
}

async function cancelPermissionRequest(userId, requestId) {
  if (!userId) {
    const error = new Error("Usuario no autenticado.");
    error.status = 401;
    throw error;
  }

  const tenant = await getTenantByUserId(userId);

  const rows = await query(
    `
      SELECT id_solicitud_permiso, estado
      FROM SOLICITUD_PERMISO
      WHERE id_solicitud_permiso = ?
        AND id_inquilino = ?
      LIMIT 1
    `,
    [Number(requestId), tenant.id_inquilino]
  );

  if (!rows[0]) {
    const error = new Error("No se encontro la solicitud.");
    error.status = 404;
    throw error;
  }

  if (rows[0].estado !== "PENDIENTE") {
    const error = new Error("Solo se pueden cancelar solicitudes pendientes.");
    error.status = 409;
    throw error;
  }

  await query(
    `
      UPDATE SOLICITUD_PERMISO
      SET estado = 'CANCELADA'
      WHERE id_solicitud_permiso = ?
    `,
    [Number(requestId)]
  );

  const updatedRows = await query(
    `
      SELECT
        id_solicitud_permiso,
        tipo_permiso,
        motivo,
        DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
        DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin,
        observaciones,
        estado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM SOLICITUD_PERMISO
      WHERE id_solicitud_permiso = ?
      LIMIT 1
    `,
    [Number(requestId)]
  );

  return updatedRows[0];
}

module.exports = {
  createPermissionRequest,
  listOwnPermissionRequests,
  cancelPermissionRequest,
};