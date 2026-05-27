const { pool, query } = require("../database/mysql");

const ALLOWED_RECIPIENT_TYPES = ["todos", "residente", "inquilino", "guardia", "admin"];

function normalizeString(value) {
  return String(value || "").trim();
}

function mapAnnouncement(row) {
  return {
    id_comunicado: row.id_comunicado,
    titulo: row.titulo,
    descripcion: row.descripcion,
    tipo_destinatario: row.tipo_destinatario,
    total_destinatarios: Number(row.total_destinatarios || 0),
    enviado_en: row.enviado_en,
    creado_por: row.creado_por,
    creado_por_nombre: row.creado_por_nombre || null,
  };
}

function normalizeRecipientType(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (!ALLOWED_RECIPIENT_TYPES.includes(normalized)) {
    const error = new Error("El tipo de destinatario es invalido.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

async function getUsersByRecipientType(recipientType) {
  if (recipientType === "todos") {
    return query(
      `
        SELECT u.id_usuario
        FROM USUARIO u
        WHERE u.activo = TRUE
      `,
    );
  }

  return query(
    `
      SELECT u.id_usuario
      FROM USUARIO u
      INNER JOIN TIPO_USUARIO tu ON tu.id_tipo_usuario = u.id_tipo_usuario
      WHERE u.activo = TRUE AND tu.nombre = ?
    `,
    [recipientType],
  );
}

async function listAnnouncements() {
  const rows = await query(
    `
      SELECT
        c.id_comunicado,
        c.titulo,
        c.descripcion,
        c.tipo_destinatario,
        c.total_destinatarios,
        DATE_FORMAT(c.enviado_en, '%Y-%m-%d %H:%i:%s') AS enviado_en,
        c.creado_por,
        u.nombre AS creado_por_nombre
      FROM COMUNICADO c
      LEFT JOIN USUARIO u ON u.id_usuario = c.creado_por
      ORDER BY c.enviado_en DESC, c.id_comunicado DESC
      LIMIT 50
    `,
  );

  return rows.map(mapAnnouncement);
}

async function sendAnnouncement(adminUserId, payload = {}) {
  const titulo = normalizeString(payload.titulo);
  const descripcion = normalizeString(payload.descripcion);
  const tipoDestinatario = normalizeRecipientType(payload.tipo_usuario);

  if (!titulo) {
    const error = new Error("El titulo del comunicado es obligatorio.");
    error.status = 400;
    throw error;
  }

  if (!descripcion) {
    const error = new Error("La descripcion del comunicado es obligatoria.");
    error.status = 400;
    throw error;
  }

  const recipients = await getUsersByRecipientType(tipoDestinatario);

  if (recipients.length === 0) {
    const error = new Error("No hay usuarios activos para el tipo seleccionado.");
    error.status = 404;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      `
        INSERT INTO COMUNICADO (
          titulo,
          descripcion,
          fecha,
          creado_por,
          tipo_destinatario,
          enviado_en,
          total_destinatarios
        )
        VALUES (?, ?, CURDATE(), ?, ?, NOW(), ?)
      `,
      [titulo, descripcion, adminUserId, tipoDestinatario, recipients.length],
    );

    const announcementId = insertResult.insertId;
    const mensaje =
      descripcion.length > 255 ? `${descripcion.slice(0, 252)}...` : descripcion;

    for (const recipient of recipients) {
      await connection.execute(
        `
          INSERT INTO COMUNICADO_USUARIO (id_comunicado, id_usuario, leido)
          VALUES (?, ?, FALSE)
        `,
        [announcementId, recipient.id_usuario],
      );

      await connection.execute(
        `
          INSERT INTO NOTIFICACION (id_usuario, id_acceso, tipo, titulo, mensaje, leido)
          VALUES (?, NULL, 'COMUNICADO', ?, ?, FALSE)
        `,
        [recipient.id_usuario, titulo, mensaje],
      );
    }

    await connection.commit();

    const rows = await query(
      `
        SELECT
          c.id_comunicado,
          c.titulo,
          c.descripcion,
          c.tipo_destinatario,
          c.total_destinatarios,
          DATE_FORMAT(c.enviado_en, '%Y-%m-%d %H:%i:%s') AS enviado_en,
          c.creado_por,
          u.nombre AS creado_por_nombre
        FROM COMUNICADO c
        LEFT JOIN USUARIO u ON u.id_usuario = c.creado_por
        WHERE c.id_comunicado = ?
        LIMIT 1
      `,
      [announcementId],
    );

    return mapAnnouncement(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listAnnouncements,
  sendAnnouncement,
  ALLOWED_RECIPIENT_TYPES,
};
