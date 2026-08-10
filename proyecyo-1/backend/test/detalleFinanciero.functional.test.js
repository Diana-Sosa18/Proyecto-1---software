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

test("el detalle financiero devuelve cargos, recargos, pagos y resumen", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/residente/detalle-financiero`, { headers: RESIDENT_HEADERS });

  assert.equal(response.status, 200);

  const detail = await response.json();
  assert.ok(Array.isArray(detail.cargos));
  assert.ok(Array.isArray(detail.recargos));
  assert.ok(Array.isArray(detail.pagos));
  assert.equal(typeof detail.resumen.total_cargos, "number");
  assert.equal(typeof detail.resumen.saldo_pendiente, "number");
  assert.equal(typeof detail.unidad, "string");
});

test("el detalle financiero acepta filtros por rango de fecha", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(
    `${API_URL}/residente/detalle-financiero?desde=2026-01-01&hasta=2026-12-31`,
    { headers: RESIDENT_HEADERS },
  );

  assert.equal(response.status, 200);

  const detail = await response.json();
  assert.equal(detail.periodo.desde, "2026-01-01");
  assert.equal(detail.periodo.hasta, "2026-12-31");
});

test("el detalle financiero rechaza usuarios que no son residentes", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/residente/detalle-financiero`, {
    headers: { "content-type": "application/json", "x-user-role": "admin", "x-user-id": "1" },
  });

  assert.equal(response.status, 403);
});
