const assert = require("node:assert/strict");
const test = require("node:test");

const API_URL = process.env.API_URL || "http://localhost:3000";
const ADMIN_HEADERS = {
  "content-type": "application/json",
  "x-user-role": "admin",
  "x-user-id": "1",
};

function skipWithoutApi() {
  return process.env.RUN_FUNCTIONAL_TESTS !== "1"
    ? "Define RUN_FUNCTIONAL_TESTS=1 con el backend levantado para ejecutar esta prueba."
    : false;
}

test("admin sanctions endpoints expose rules, summary and history", { skip: skipWithoutApi() }, async () => {
  const [summaryResponse, rulesResponse, historyResponse] = await Promise.all([
    fetch(`${API_URL}/admin/sanciones/resumen`, { headers: ADMIN_HEADERS }),
    fetch(`${API_URL}/admin/sanciones/reglas`, { headers: ADMIN_HEADERS }),
    fetch(`${API_URL}/admin/sanciones/historial`, { headers: ADMIN_HEADERS }),
  ]);

  assert.equal(summaryResponse.status, 200);
  assert.equal(rulesResponse.status, 200);
  assert.equal(historyResponse.status, 200);

  const summary = await summaryResponse.json();
  const rules = await rulesResponse.json();
  const history = await historyResponse.json();

  assert.equal(typeof summary.total, "number");
  assert.ok(rules.some((rule) => rule.codigo === "CUOTA_VENCIDA"));
  assert.ok(Array.isArray(history));
});

test("admin can request automatic sanction generation", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/admin/sanciones/generar`, {
    method: "POST",
    headers: ADMIN_HEADERS,
  });

  assert.equal(response.status, 201);

  const result = await response.json();
  assert.equal(typeof result.generadas, "number");
  assert.match(result.fecha_revision, /^\d{4}-\d{2}-\d{2}$/);
});
