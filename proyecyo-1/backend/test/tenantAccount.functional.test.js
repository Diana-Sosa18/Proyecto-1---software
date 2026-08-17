const assert = require("node:assert/strict");
const test = require("node:test");

const API_URL = process.env.API_URL || "http://localhost:3000";
const TENANT_HEADERS = {
  "content-type": "application/json",
  "x-user-role": "inquilino",
  "x-user-id": "4",
};

function skipWithoutApi() {
  return process.env.RUN_FUNCTIONAL_TESTS !== "1"
    ? "Define RUN_FUNCTIONAL_TESTS=1 con el backend levantado para ejecutar esta prueba."
    : false;
}

test("tenant account statement exposes rent and additional quotas", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/inquilino/estado-cuenta`, {
    headers: TENANT_HEADERS,
  });

  assert.equal(response.status, 200);

  const statement = await response.json();

  assert.equal(typeof statement.resumen.saldo_pendiente, "number");
  assert.equal(typeof statement.resumen.alquiler_pendiente, "number");
  assert.equal(typeof statement.resumen.cuotas_adicionales_pendientes, "number");
  assert.ok(Array.isArray(statement.alquiler));
  assert.ok(Array.isArray(statement.cuotas_adicionales));
});
