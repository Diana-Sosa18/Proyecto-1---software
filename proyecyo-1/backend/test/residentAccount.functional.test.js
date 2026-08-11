const assert = require("node:assert/strict");
const test = require("node:test");

const API_URL = process.env.API_URL || "http://localhost:3000";
const RESIDENT_HEADERS = {
  "content-type": "application/json",
  "x-user-role": "residente",
  "x-user-id": "3",
};

function skipWithoutApi() {
  return process.env.RUN_FUNCTIONAL_TESTS !== "1"
    ? "Define RUN_FUNCTIONAL_TESTS=1 con el backend levantado para ejecutar esta prueba."
    : false;
}

test("resident account statement exposes summary and quotas", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/residente/estado-cuenta`, {
    headers: RESIDENT_HEADERS,
  });

  assert.equal(response.status, 200);

  const statement = await response.json();

  assert.equal(typeof statement.resumen.saldo_pendiente, "number");
  assert.equal(typeof statement.resumen.cuotas_pagadas, "number");
  assert.equal(typeof statement.resumen.cuotas_vencidas, "number");
  assert.ok(Array.isArray(statement.cuotas));
});
