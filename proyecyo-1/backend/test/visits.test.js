const assert = require("node:assert/strict");
const test = require("node:test");

const { __private__ } = require("../src/services/visitsService");

test("ensureQrExitCanBeRegistered allows exit after a registered entry", () => {
  assert.equal(
    __private__.ensureQrExitCanBeRegistered({
      estado_acceso: "INGRESO_REGISTRADO",
      qr_status: "USED",
      hora_salida: null,
    }),
    true,
  );
});

test("ensureQrExitCanBeRegistered rejects exit before entry", () => {
  assert.throws(
    () =>
      __private__.ensureQrExitCanBeRegistered({
        estado_acceso: "AUTORIZADA",
        qr_status: "VALID",
        hora_salida: null,
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /Primero debe registrarse el ingreso/);
      return true;
    },
  );
});

test("ensureQrExitCanBeRegistered rejects duplicate exits", () => {
  assert.throws(
    () =>
      __private__.ensureQrExitCanBeRegistered({
        estado_acceso: "SALIDA_REGISTRADA",
        qr_status: "EXIT_REGISTERED",
        hora_salida: "18:35",
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /salida de esta visita ya fue registrada/i);
      return true;
    },
  );
});

test("ensureQrExitCanBeRegistered rejects cancelled accesses", () => {
  assert.throws(
    () =>
      __private__.ensureQrExitCanBeRegistered({
        estado_acceso: "CANCELADA",
        qr_status: "CANCELLED",
        hora_salida: null,
      }),
    (error) => {
      assert.equal(error.status, 410);
      assert.match(error.message, /QR ya no es valido/);
      return true;
    },
  );
});
