const assert = require("node:assert/strict");
const test = require("node:test");

const { __private__ } = require("../src/services/adminRemindersService");

test("normalizeReminderType acepta tipos validos y filtro TODOS", () => {
  assert.equal(__private__.normalizeReminderType("vencido"), "VENCIDO");
  assert.equal(__private__.normalizeReminderType(" PROXIMO_VENCIMIENTO "), "PROXIMO_VENCIMIENTO");
  assert.equal(__private__.normalizeReminderType("TODOS"), null);
  assert.equal(__private__.normalizeReminderType(""), null);
});

test("normalizeReminderType rechaza tipos invalidos", () => {
  assert.throws(() => __private__.normalizeReminderType("PENDIENTE"), /tipo de recordatorio es invalido/);
});

test("normalizeDaysBefore acepta enteros entre 0 y 60", () => {
  assert.equal(__private__.normalizeDaysBefore("3"), 3);
  assert.equal(__private__.normalizeDaysBefore(0), 0);
  assert.equal(__private__.normalizeDaysBefore(60), 60);
});

test("normalizeDaysBefore rechaza valores fuera de rango o no enteros", () => {
  assert.throws(() => __private__.normalizeDaysBefore(-1), /entre 0 y 60/);
  assert.throws(() => __private__.normalizeDaysBefore(61), /entre 0 y 60/);
  assert.throws(() => __private__.normalizeDaysBefore(2.5), /entre 0 y 60/);
});

test("buildHouseLabel une torre y numero solo cuando hay torre", () => {
  assert.equal(__private__.buildHouseLabel({ torre: "B", numero: "302" }), "B-302");
  assert.equal(__private__.buildHouseLabel({ torre: "", numero: "101" }), "101");
});

test("buildReminderTemplate arma el mensaje de proximo vencimiento", () => {
  const template = __private__.buildReminderTemplate({
    tipo: "PROXIMO_VENCIMIENTO",
    servicio: "Agua potable",
    monto: 755,
    fecha_limite: "2026-08-06",
    dias_para_vencer: 3,
  });

  assert.equal(template.titulo, "Recordatorio de pago proximo");
  assert.match(template.mensaje, /Agua potable/);
  assert.match(template.mensaje, /Q755\.00/);
  assert.match(template.mensaje, /vence en 3 dias/);
});

test("buildReminderTemplate usa 'vence manana' y 'vence hoy'", () => {
  assert.match(
    __private__.buildReminderTemplate({
      tipo: "PROXIMO_VENCIMIENTO",
      servicio: "Mantenimiento",
      monto: 100,
      fecha_limite: "2026-08-04",
      dias_para_vencer: 1,
    }).mensaje,
    /vence manana/,
  );

  assert.match(
    __private__.buildReminderTemplate({
      tipo: "PROXIMO_VENCIMIENTO",
      servicio: "Mantenimiento",
      monto: 100,
      fecha_limite: "2026-08-03",
      dias_para_vencer: 0,
    }).mensaje,
    /vence hoy/,
  );
});

test("buildReminderTemplate arma el mensaje de cuota vencida con dias en positivo", () => {
  const template = __private__.buildReminderTemplate({
    tipo: "VENCIDO",
    servicio: "Agua potable",
    monto: 500,
    fecha_limite: "2026-07-30",
    dias_para_vencer: -4,
  });

  assert.equal(template.titulo, "Pago vencido pendiente");
  assert.match(template.mensaje, /vencio el 2026-07-30/);
  assert.match(template.mensaje, /hace 4 dias/);
});

test("mapReminder convierte filas de base de datos en registros de API", () => {
  const record = __private__.mapReminder({
    id_recordatorio: "5",
    torre: "A",
    numero: "101",
    residente: "Residente Demo",
    correo: "residente@test.com",
    tipo: "VENCIDO",
    titulo: "Pago vencido pendiente",
    mensaje: "Su cuota vencio.",
    monto: "500.00",
    fecha_limite: "2026-07-30",
    dias_para_vencer: "-4",
    servicio: "Agua potable",
    enviado_en: "2026-08-03 09:15",
  });

  assert.deepEqual(record, {
    id_recordatorio: 5,
    casa_unidad: "A-101",
    residente: "Residente Demo",
    correo: "residente@test.com",
    tipo: "VENCIDO",
    titulo: "Pago vencido pendiente",
    mensaje: "Su cuota vencio.",
    monto: 500,
    fecha_limite: "2026-07-30",
    dias_para_vencer: -4,
    servicio: "Agua potable",
    enviado_en: "2026-08-03 09:15",
  });
});
