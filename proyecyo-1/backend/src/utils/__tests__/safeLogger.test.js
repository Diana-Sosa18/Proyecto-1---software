const { sanitize, sanitizeText, logger } = require("../safeLogger");
test("redacta credenciales y datos de tarjeta en objetos anidados", () => {
  const output = JSON.stringify(sanitize({ headers: { "X-SECRET-KEY": "test-a", Authorization: "Bearer test-b" },
    nested: { RECURRENTE_WEBHOOK_SECRET: "test-c", pan: "test-d", cvc: "test-e", body: { sensitive: "test-f" } },
    safe: "visible", bytes: Buffer.from("test-g") }));
  for (const value of ["test-a", "test-b", "test-c", "test-d", "test-e", "test-f", "test-g"]) expect(output).not.toContain(value);
  expect(output).toContain("visible");
});
test("sanitiza texto, secretos configurados y credenciales URL", () => {
  const previous = process.env.RECURRENTE_SECRET_KEY;
  process.env.RECURRENTE_SECRET_KEY = "test-environment-value";
  try {
    const output = sanitizeText("X-SECRET-KEY=test-header Authorization: Bearer test-token test-environment-value https://test-user:test-password@example.invalid");
    for (const value of ["test-header", "test-token", "test-environment-value", "test-password"]) expect(output).not.toContain(value);
  } finally {
    if (previous === undefined) delete process.env.RECURRENTE_SECRET_KEY;
    else process.env.RECURRENTE_SECRET_KEY = previous;
  }
});
test("Authorization Basic y valores JSON completos se eliminan", () => {
  expect(sanitizeText('Authorization: Basic test-credential')).not.toContain("test-credential");
  expect(sanitizeText('{"Authorization":"Bearer test-credential","X-SECRET-KEY":"test-key"}')).not.toMatch(/test-credential|test-key/);
});
test("excepciones no imprimen request, response ni stack del SDK", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const error = Object.assign(new Error("Authorization: Bearer test-token"), { code: "SDK_FAILURE", config: { secret: "test-config" } });
    logger.error("Fallo", error);
    const output = JSON.stringify(spy.mock.calls);
    expect(output).not.toMatch(/test-token|test-config|stack/);
    expect(output).toContain("SDK_FAILURE");
  } finally { spy.mockRestore(); }
});
test("tolera ciclos y no ejecuta getters", () => {
  const object = { safe: "ok" }; object.self = object;
  Object.defineProperty(object, "getter", { get: () => { throw new Error("must not execute"); }, enumerable: true });
  expect(sanitize(object)).toMatchObject({ self: "[CIRCULAR]", getter: "[ACCESSOR]" });
});
