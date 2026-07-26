const { query } = require("../database/mysql");

const PERMISSION_SEPARATOR = "||";

function normalizeString(value) {
  return String(value || "").trim();
}

function mapAuthorizedUser(row) {
  return {
    id_usuario: Number(row.id_usuario),
    nombre: row.nombre,
    correo: row.correo,
    telefono: row.telefono || null,
    unidades: row.unidades,
    permisos_activos: row.permisos_activos ? row.permisos_activos.split(PERMISSION_SEPARATOR) : [],
    total_permisos_activos: Number(row.total_permisos_activos || 0),
  };
}

async function listAuthorizedTenants(filters = {}) {
  const search = normalizeString(filters.search).toLowerCase();
  const sqlFilters = ["1 = 1"];
  const params = [];

  if (search) {
    sqlFilters.push(`
      (
        LOWER(resumen.nombre) LIKE ?
        OR LOWER(resumen.correo) LIKE ?
        OR LOWER(resumen.unidades) LIKE ?
      )
    `);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const rows = await query(
    `
      SELECT * FROM (
        SELECT
          u.id_usuario,
          u.nombre,
          u.correo,
          u.telefono,
          COALESCE(casas.unidades, 'Sin unidad asignada') AS unidades,
          permisos.permisos_activos,
          COALESCE(permisos.total_permisos_activos, 0) AS total_permisos_activos
        FROM INQUILINO i
        INNER JOIN USUARIO u ON u.id_usuario = i.id_usuario
        LEFT JOIN (
          SELECT
            ic.id_inquilino,
            GROUP_CONCAT(
              DISTINCT CASE
                WHEN c.torre IS NOT NULL AND c.torre <> '' THEN CONCAT(c.torre, '-', c.numero)
                ELSE c.numero
              END
              ORDER BY c.numero SEPARATOR ', '
            ) AS unidades
          FROM INQUILINO_CASA ic
          INNER JOIN CASA c ON c.id_casa = ic.id_casa
          GROUP BY ic.id_inquilino
        ) casas ON casas.id_inquilino = i.id_inquilino
        LEFT JOIN (
          SELECT
            id_usuario,
            GROUP_CONCAT(DISTINCT nombre ORDER BY nombre SEPARATOR '${PERMISSION_SEPARATOR}') AS permisos_activos,
            COUNT(*) AS total_permisos_activos
          FROM PERMISO_INQUILINO
          WHERE estado = 'ACTIVO'
            AND fecha_inicio <= CURDATE()
            AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
          GROUP BY id_usuario
        ) permisos ON permisos.id_usuario = u.id_usuario
        WHERE i.autorizado = TRUE
      ) resumen
      WHERE ${sqlFilters.join(" AND ")}
      ORDER BY resumen.nombre ASC
    `,
    params,
  );

  return rows.map(mapAuthorizedUser);
}

module.exports = {
  listAuthorizedTenants,
};
