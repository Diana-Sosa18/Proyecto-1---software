const assert = require("node:assert/strict");
const test = require("node:test");

const { __private__ } = require("../src/services/adminSanctionsService");

test("normalizeSanctionStatus accepts valid statuses and empty all filter", () => {
  assert.equal(__private__.normalizeSanctionStatus("pendiente"), "PENDIENTE");
  assert.equal(__private__.normalizeSanctionStatus(" PAGADA "), "PAGADA");
  assert.equal(__private__.normalizeSanctionStatus("TODOS"), null);
  assert.equal(__private__.normalizeSanctionStatus(""), null);
});

test("normalizeSanctionStatus rejects invalid statuses", () => {
  assert.throws(
    () => __private__.normalizeSanctionStatus("ABIERTA"),
    /estado de sancion es invalido/,
  );
});

test("buildHouseLabel joins tower and number only when tower exists", () => {
  assert.equal(__private__.buildHouseLabel({ torre: "B", numero: "302" }), "B-302");
  assert.equal(__private__.buildHouseLabel({ torre: "", numero: "101" }), "101");
});

test("calculateSanctionAmount uses the minimum or percentage amount", () => {
  assert.equal(__private__.calculateSanctionAmount(200), 50);
  assert.equal(__private__.calculateSanctionAmount(750), 75);
  assert.equal(__private__.calculateSanctionAmount(755.55), 75.56);
});

test("mapSanction converts database rows to API records", () => {
  const record = __private__.mapSanction({
    id_sancion: 3,
    torre: "A",
    numero: "101",
    residente: "Residente Demo",
    codigo_regla: "CUOTA_VENCIDA",
    motivo: "Cuota vencida",
    detalle: "Pago pendiente",
    monto: "75.50",
    estado: "PENDIENTE",
    generada_automaticamente: 1,
    fecha_incumplimiento: "2026-07-01",
    fecha_generacion: "2026-07-19 10:00",
    cuota_monto: "755.00",
    fecha_limite: "2026-07-01",
    servicio: "Agua potable",
  });

  assert.deepEqual(record, {
    id_sancion: 3,
    casa_unidad: "A-101",
    residente: "Residente Demo",
    codigo_regla: "CUOTA_VENCIDA",
    motivo: "Cuota vencida",
    detalle: "Pago pendiente",
    monto: 75.5,
    estado: "PENDIENTE",
    generada_automaticamente: true,
    fecha_incumplimiento: "2026-07-01",
    fecha_generacion: "2026-07-19 10:00",
    cuota_monto: 755,
    fecha_limite: "2026-07-01",
    servicio: "Agua potable",
  });
});
