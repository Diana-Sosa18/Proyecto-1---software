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

function formatDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

test("admin reservation conflict endpoint reports user reservation limit status", { skip: skipWithoutApi() }, async () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  const query = new URLSearchParams({
    id_usuario: "3",
    id_amenidad: "1",
    fecha: formatDate(futureDate),
    hora_inicio: "08:00",
    hora_fin: "09:00",
  });

  const response = await fetch(`${API_URL}/admin/reservas/amenidades/conflicto?${query}`, {
    headers: ADMIN_HEADERS,
  });

  assert.equal(response.status, 200);

  const result = await response.json();
  assert.equal(typeof result.conflicto, "boolean");
  assert.equal(typeof result.limite_alcanzado, "boolean");
  assert.equal(result.limite_reservas, 3);
  assert.equal(typeof result.reservas_activas_usuario, "number");
});
