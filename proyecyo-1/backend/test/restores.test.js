const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { validateBackupPayload } = require("../src/services/restoresService");

describe("HU5 validación segura de respaldos", () => {
  it("acepta sentencias de datos sobre tablas de la aplicación", () => {
    const result = validateBackupPayload({
      filename: "respaldo.sql",
      content: "INSERT INTO `USUARIO` (`nombre`) VALUES ('Ana');",
    });

    assert.equal(result.statements.length, 1);
    assert.deepEqual(result.tables, ["USUARIO"]);
  });

  it("rechaza contenido aunque use una extensión sql válida", () => {
    assert.throws(
      () => validateBackupPayload({ filename: "malicioso.sql", content: "DROP TABLE USUARIO;" }),
      /instrucciones no permitidas|solo puede modificar datos/i,
    );
  });

  it("rechaza sentencias sobre tablas ajenas a la aplicación", () => {
    assert.throws(
      () => validateBackupPayload({
        filename: "malicioso.sql",
        content: "INSERT INTO mysql.user (User) VALUES ('intruso');",
      }),
      /tablas autorizadas/i,
    );
  });

  it("rechaza archivos vacíos, con extensión inválida o demasiado grandes", () => {
    assert.throws(
      () => validateBackupPayload({ filename: "respaldo.txt", content: "INSERT INTO USUARIO VALUES (1);" }),
      /extension .sql/i,
    );
    assert.throws(
      () => validateBackupPayload({ filename: "respaldo.sql", content: "" }),
      /vacio/i,
    );
    assert.throws(
      () => validateBackupPayload({ filename: "respaldo.sql", content: "A".repeat(2 * 1024 * 1024 + 1) }),
      /2 MB/i,
    );
  });
});
