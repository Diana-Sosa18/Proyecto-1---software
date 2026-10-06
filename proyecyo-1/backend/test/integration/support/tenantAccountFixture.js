// SOLO PRUEBAS. Reproduce los datos que antes sembraba ensureTenantAccountSeed() en el
// arranque de produccion (servicio "Alquiler residencial" y una cuota de Q2,200.00 por
// casa con inquilino autorizado). HU32 lo saco del arranque normal; aqui se conserva
// para que las bases desechables del runner aislado tengan el mismo estado que antes.
const { assertOwnedSuiteDatabase } = require("./suiteIsolation");

async function seedTenantAccountFixture(query) {
  assertOwnedSuiteDatabase(); // Nunca contra la base compartida ni una base normal.
  await query(`
    INSERT INTO SERVICIO (nombre, tipo_servicio, descripcion)
    SELECT 'Alquiler residencial', 'Alquiler', 'Cuota mensual de alquiler asociada al inquilino.'
    WHERE NOT EXISTS (
      SELECT 1 FROM SERVICIO WHERE LOWER(nombre) = 'alquiler residencial' LIMIT 1
    )
  `);

  await query(`
    INSERT IGNORE INTO CASA_SERVICIO (id_casa, id_servicio, activo, estado_validacion)
    SELECT ic.id_casa, s.id_servicio, TRUE, 'VALIDADO'
    FROM INQUILINO_CASA ic
    INNER JOIN INQUILINO i ON i.id_inquilino = ic.id_inquilino
    INNER JOIN SERVICIO s ON s.nombre = 'Alquiler residencial'
    WHERE i.autorizado = TRUE
  `);

  await query(`
    INSERT INTO CUOTA (id_servicio, id_casa, monto, fecha_limite)
    SELECT s.id_servicio, ic.id_casa, 2200.00, LAST_DAY(CURDATE())
    FROM INQUILINO_CASA ic
    INNER JOIN INQUILINO i ON i.id_inquilino = ic.id_inquilino
    INNER JOIN SERVICIO s ON s.nombre = 'Alquiler residencial'
    WHERE i.autorizado = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM CUOTA cu
        WHERE cu.id_casa = ic.id_casa AND cu.id_servicio = s.id_servicio
        LIMIT 1
      )
  `);
}

module.exports = { seedTenantAccountFixture };
