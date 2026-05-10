const { query } = require("../database/mysql");

function normalizeNotification(row) {
  return {
    id_notificacion: row.id_notificacion,
    id_usuario: row.id_usuario,
    id_acceso: row.id_acceso,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    leido: Boolean(row.leido),
    creado_en: row.creado_en,
    leido_en: row.leido_en || null,
    visitante: row.visitante || null,
    casa: row.casa || null,
  };
}

async function listNotifications(userId) {
  const rows = await query(
    `
      SELECT
        n.id_notificacion,
        n.id_usuario,
        n.id_acceso,
        n.tipo,
        n.titulo,
        n.mensaje,
        n.leido,
        DATE_FORMAT(n.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,
        DATE_FORMAT(n.leido_en, '%Y-%m-%d %H:%i:%s') AS leido_en,
        v.nombre AS visitante,
        CONCAT(
          COALESCE(c.torre, ''),
          CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
          c.numero
        ) AS casa
      FROM NOTIFICACION n
      LEFT JOIN ACCESO a ON a.id_acceso = n.id_acceso
      LEFT JOIN VISITANTE v ON v.id_visitante = a.id_visitante
      LEFT JOIN CASA c ON c.id_casa = a.id_casa
      WHERE n.id_usuario = ?
      ORDER BY n.creado_en DESC, n.id_notificacion DESC
      LIMIT 20
    `,
    [userId],
  );

  return rows.map(normalizeNotification);
}

async function countUnreadNotifications(userId) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM NOTIFICACION
      WHERE id_usuario = ? AND leido = FALSE
    `,
    [userId],
  );

  return Number(rows[0]?.total || 0);
}

async function markNotificationAsRead(userId, notificationId) {
  const normalizedId = Number(notificationId);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    const error = new Error("La notificacion es invalida.");
    error.status = 400;
    throw error;
  }

  await query(
    `
      UPDATE NOTIFICACION
      SET leido = TRUE,
          leido_en = COALESCE(leido_en, NOW())
      WHERE id_notificacion = ? AND id_usuario = ?
    `,
    [normalizedId, userId],
  );

  const rows = await query(
    `
      SELECT
        n.id_notificacion,
        n.id_usuario,
        n.id_acceso,
        n.tipo,
        n.titulo,
        n.mensaje,
        n.leido,
        DATE_FORMAT(n.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,
        DATE_FORMAT(n.leido_en, '%Y-%m-%d %H:%i:%s') AS leido_en,
        v.nombre AS visitante,
        CONCAT(
          COALESCE(c.torre, ''),
          CASE WHEN c.torre IS NOT NULL AND c.torre <> '' THEN '-' ELSE '' END,
          c.numero
        ) AS casa
      FROM NOTIFICACION n
      LEFT JOIN ACCESO a ON a.id_acceso = n.id_acceso
      LEFT JOIN VISITANTE v ON v.id_visitante = a.id_visitante
      LEFT JOIN CASA c ON c.id_casa = a.id_casa
      WHERE n.id_notificacion = ? AND n.id_usuario = ?
      LIMIT 1
    `,
    [normalizedId, userId],
  );

  if (!rows[0]) {
    const error = new Error("Notificacion no encontrada.");
    error.status = 404;
    throw error;
  }

  return normalizeNotification(rows[0]);
}

async function markAllNotificationsAsRead(userId) {
  await query(
    `
      UPDATE NOTIFICACION
      SET leido = TRUE,
          leido_en = COALESCE(leido_en, NOW())
      WHERE id_usuario = ? AND leido = FALSE
    `,
    [userId],
  );

  return { unread: 0 };
}

module.exports = {
  listNotifications,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};