const assert = require("node:assert/strict");
const test = require("node:test");
const { __private__ } = require("../src/services/visitsService");

test("HU10 acepta únicamente los tipos centrales permitidos", () => {
  assert.equal(__private__.ensureVisitType("visita"), "VISITA");
  assert.equal(__private__.ensureVisitType("DELIVERY"), "DELIVERY");
  assert.equal(__private__.ensureVisitType(" proveedor "), "PROVEEDOR");
  assert.throws(() => __private__.ensureVisitType("ARBITRARIO"), /tipo de visita es invalido/);
});
