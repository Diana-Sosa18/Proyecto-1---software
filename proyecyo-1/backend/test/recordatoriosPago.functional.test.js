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

test("los endpoints de recordatorios exponen resumen, configuracion e historial", { skip: skipWithoutApi() }, async () => {
  const [summaryResponse, configResponse, historyResponse] = await Promise.all([
    fetch(`${API_URL}/admin/recordatorios/resumen`, { headers: ADMIN_HEADERS }),
    fetch(`${API_URL}/admin/recordatorios/configuracion`, { headers: ADMIN_HEADERS }),
    fetch(`${API_URL}/admin/recordatorios`, { headers: ADMIN_HEADERS }),
  ]);

  assert.equal(summaryResponse.status, 200);
  assert.equal(configResponse.status, 200);
  assert.equal(historyResponse.status, 200);

  const summary = await summaryResponse.json();
  const config = await configResponse.json();
  const history = await historyResponse.json();

  assert.equal(typeof summary.total, "number");
  assert.equal(typeof config.activo, "boolean");
  assert.equal(typeof config.dias_antes, "number");
  assert.ok(Array.isArray(history));
});

test("el endpoint de recordatorios rechaza usuarios no administradores", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/admin/recordatorios`, {
    headers: { "content-type": "application/json", "x-user-role": "residente", "x-user-id": "3" },
  });

  assert.equal(response.status, 403);
});

test("el administrador puede solicitar el envio automatico de recordatorios", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/admin/recordatorios/generar`, {
    method: "POST",
    headers: ADMIN_HEADERS,
  });

  assert.equal(response.status, 201);

  const result = await response.json();
  assert.equal(typeof result.enviados, "number");
  assert.equal(typeof result.activo, "boolean");
  assert.match(result.fecha_revision, /^\d{4}-\d{2}-\d{2}$/);
});

test("la configuracion de recordatorios valida los dias de anticipacion", { skip: skipWithoutApi() }, async () => {
  const response = await fetch(`${API_URL}/admin/recordatorios/configuracion`, {
    method: "PUT",
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ activo: true, dias_antes: 999 }),
  });

  assert.equal(response.status, 400);
});
