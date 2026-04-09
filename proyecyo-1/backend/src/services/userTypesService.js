const { query } = require("../database/mysql");

async function listUserTypes() {
  const rows = await query(
    `
      SELECT
        id_tipo_usuario AS id,
        nombre
      FROM TIPO_USUARIO
      ORDER BY nombre ASC
    `,
  );

  return rows;
}

module.exports = {
  listUserTypes,
};
