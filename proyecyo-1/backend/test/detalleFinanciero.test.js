const assert = require("node:assert/strict");
const test = require("node:test");

const { __private__ } = require("../src/services/residentFinancialDetailService");

test("normalizeDate acepta formato ISO y descarta el resto", () => {
  assert.equal(__private__.normalizeDate("2026-08-04"), "2026-08-04");
  assert.equal(__private__.normalizeDate(" 2026-08-04 "), "2026-08-04");
  assert.equal(__private__.normalizeDate("04/08/2026"), "");
  assert.equal(__private__.normalizeDate(""), "");
});

test("computeChargeStatus distingue pagado, parcial y pendiente", () => {
  assert.equal(__private__.computeChargeStatus(100, 100), "PAGADO");
  assert.equal(__private__.computeChargeStatus(100, 120), "PAGADO");
  assert.equal(__private__.computeChargeStatus(100, 40), "PARCIAL");
  assert.equal(__private__.computeChargeStatus(100, 0), "PENDIENTE");
});

test("mapCharge calcula saldo con recargo y estado", () => {
  const record = __private__.mapCharge({
    id_cuota: "7",
    servicio: "Agua potable",
    monto: "500.00",
    pagado: "200.00",
    recargo: "25.00",
    fecha_limite: "2026-07-30",
  });

  assert.deepEqual(record, {
    id_cuota: 7,
    servicio: "Agua potable",
    monto: 500,
    pagado: 200,
    recargo: 25,
    saldo: 325,
    fecha_limite: "2026-07-30",
    estado: "PARCIAL",
  });
});

test("mapCharge deja saldo en cero cuando el pago cubre monto y recargo", () => {
  const record = __private__.mapCharge({
    id_cuota: 9,
    servicio: "Mantenimiento",
    monto: 100,
    pagado: 130,
    recargo: 20,
    fecha_limite: "2026-06-30",
  });

  assert.equal(record.saldo, 0);
  assert.equal(record.estado, "PAGADO");
});

test("mapSurcharge convierte filas de recargo", () => {
  const record = __private__.mapSurcharge({
    id_recargo: "3",
    id_cuota: "7",
    servicio: "Agua potable",
    tipo_regla: "PORCENTAJE",
    monto_original: "500.00",
    monto_recargo: "25.00",
    fecha_aplicacion: "2026-08-01",
  });

  assert.deepEqual(record, {
    id_recargo: 3,
    id_cuota: 7,
    servicio: "Agua potable",
    tipo_regla: "PORCENTAJE",
    monto_original: 500,
    monto_recargo: 25,
    fecha_aplicacion: "2026-08-01",
  });
});

test("mapPayment convierte filas de pago", () => {
  const record = __private__.mapPayment({
    id_pago: "11",
    id_cuota: "7",
    servicio: "Agua potable",
    monto_pagado: "200.00",
    fecha_pago: "2026-07-15",
  });

  assert.deepEqual(record, {
    id_pago: 11,
    id_cuota: 7,
    servicio: "Agua potable",
    monto_pagado: 200,
    fecha_pago: "2026-07-15",
    numero_comprobante: "NXR-00000011",
  });
});
