const assert = require("node:assert/strict");
const test = require("node:test");
const { validateDemoRequest, pagination, adminFilters, DEMO_STATUSES } = require("../src/services/demoRequestsService");

const valid = {
  nombre: "  María   López ",
  correo: "MARIA@EXAMPLE.COM",
  telefono: "+502 5555-5555",
  residencial: "Condominio Las Flores",
  cantidadViviendas: 120,
  mensaje: "Deseo conocer la plataforma.",
  aceptaContacto: true,
};

test("landing acepta y normaliza una solicitud válida", () => {
  const result = validateDemoRequest(valid);
  assert.equal(result.nombre, "María López");
  assert.equal(result.correo, "maria@example.com");
  assert.equal(result.cantidadViviendas, 120);
});

test("landing rechaza campos obligatorios y valores inválidos", () => {
  assert.throws(() => validateDemoRequest({ ...valid, nombre: "" }), /nombre/);
  assert.throws(() => validateDemoRequest({ ...valid, correo: "correo" }), /correo/);
  assert.throws(() => validateDemoRequest({ ...valid, telefono: "12" }), /teléfono/);
  assert.throws(() => validateDemoRequest({ ...valid, cantidadViviendas: 0 }), /cantidad/);
  assert.throws(() => validateDemoRequest({ ...valid, aceptaContacto: false }), /aceptar/);
});

test("landing limita mensaje y bloquea honeypot", () => {
  assert.throws(() => validateDemoRequest({ ...valid, mensaje: "x".repeat(1001) }), /1000/);
  assert.throws(() => validateDemoRequest({ ...valid, sitioWeb: "spam.example" }), /procesar/);
});

test("administración valida filtros, estados y paginación", () => {
  assert.deepEqual(pagination({ page: "2", limit: "25" }), { page: 2, limit: 25, offset: 25 });
  assert.equal(pagination({ page: "-2", limit: "999" }).limit, 100);
  assert.deepEqual(DEMO_STATUSES, ["NUEVA", "CONTACTADA", "DESCARTADA", "CONVERTIDA"]);
  assert.throws(() => adminFilters({ estado: "BORRADA" }), /Estado/);
  assert.throws(() => adminFilters({ desde: "2026-12-01", hasta: "2026-01-01" }), /rango/);
});
