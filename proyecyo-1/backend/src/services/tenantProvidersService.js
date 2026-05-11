const { query } = require("../database/mysql");

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function getTenantHouse(userId) {
  const rows = await query(
    `
      SELECT
        c.id_casa,
        c.numero,
        c.torre
      FROM INQUILINO i
      INNER JOIN INQUILINO_CASA ic
        ON ic.id_inquilino = i.id_inquilino
      INNER JOIN CASA c
        ON c.id_casa = ic.id_casa
      WHERE i.id_usuario = ?
        AND i.autorizado = TRUE
      LIMIT 1
    `,
    [userId],
  );

  const house = rows[0];

  if (!house) {
    const error = new Error("No se encontro una casa autorizada para este inquilino.");
    error.status = 404;
    throw error;
  }

  return house;
}

function mapProvider(row) {
  const isLinked = row.id_casa !== null && row.id_casa !== undefined;

  return {
    id_servicio: Number(row.id_servicio),
    nombre: row.nombre,
    tipo_servicio: row.tipo_servicio || "General",
    descripcion: row.descripcion || "Servicio residencial disponible para tu unidad.",
    activo: isLinked ? Number(row.activo) === 1 : false,
    estado: isLinked ? row.estado_validacion || "PENDIENTE" : "PENDIENTE",
    casa_unidad: row.torre ? `${row.torre}-${row.numero}` : row.numero,
  };
}

async function listTenantProviders(userId) {
  const house = await getTenantHouse(userId);
  const rows = await query(
    `
      SELECT
        s.id_servicio,
        s.nombre,
        s.tipo_servicio,
        s.descripcion,
        cs.id_casa,
        cs.activo,
        cs.estado_validacion,
        c.numero,
        c.torre
      FROM SERVICIO s
      CROSS JOIN CASA c
      LEFT JOIN CASA_SERVICIO cs
        ON cs.id_servicio = s.id_servicio
        AND cs.id_casa = c.id_casa
      WHERE c.id_casa = ?
      ORDER BY s.nombre ASC
    `,
    [house.id_casa],
  );

  return rows.map(mapProvider);
}

async function updateTenantProvider(userId, serviceId, payload = {}) {
  const normalizedServiceId = Number(serviceId);

  if (!Number.isInteger(normalizedServiceId) || normalizedServiceId <= 0) {
    const error = new Error("El servicio indicado no es valido.");
    error.status = 400;
    throw error;
  }

  const house = await getTenantHouse(userId);
  const serviceRows = await query("SELECT id_servicio FROM SERVICIO WHERE id_servicio = ? LIMIT 1", [
    normalizedServiceId,
  ]);

  if (serviceRows.length === 0) {
    const error = new Error("El proveedor indicado no existe.");
    error.status = 404;
    throw error;
  }

  const active = normalizeBoolean(payload.activo);

  await query(
    `
      INSERT INTO CASA_SERVICIO (id_casa, id_servicio, activo, estado_validacion)
      VALUES (?, ?, ?, 'PENDIENTE')
      ON DUPLICATE KEY UPDATE
        activo = VALUES(activo),
        estado_validacion = CASE
          WHEN estado_validacion = 'VALIDADO' THEN estado_validacion
          ELSE 'PENDIENTE'
        END
    `,
    [house.id_casa, normalizedServiceId, active],
  );

  const providers = await listTenantProviders(userId);
  return providers.find((provider) => provider.id_servicio === normalizedServiceId);
}

module.exports = {
  listTenantProviders,
  updateTenantProvider,
};
