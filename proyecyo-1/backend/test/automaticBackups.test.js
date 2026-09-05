const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { validateConfig, resolveKnownFile } = require("../src/services/automaticBackupsService");
test("HU14 valida configuracion controlada", () => {
  assert.deepEqual(validateConfig({ activo: true, frecuencia: "diario", hora: "02:30", retencion: 7 }), { activo: true, frecuencia: "DIARIO", hora: "02:30", retencion: 7 });
  assert.throws(() => validateConfig({ frecuencia: "* * * * *", hora: "02:30", retencion: 7 }), /Frecuencia/);
  assert.throws(() => validateConfig({ frecuencia: "DIARIO", hora: "29:00", retencion: 7 }), /Hora/);
});
test("HU14 impide traversal en descargas", () => {
  assert.throws(() => resolveKnownFile("../secret.sql"), /invalido/);
  assert.equal(path.basename(resolveKnownFile("nexus-2026.sql")), "nexus-2026.sql");
});
test("HU14 limita la retencion a valores seguros", () => {
  assert.throws(() => validateConfig({ activo: true, frecuencia: "DIARIO", hora: "02:00", retencion: 31 }), /retencion/);
});
