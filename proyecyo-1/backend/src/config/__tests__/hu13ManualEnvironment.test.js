jest.mock("dotenv", () => ({ config: jest.fn() }));
const { configureManualEnvironment } = require("../../../scripts/start-hu13-sandbox");
const previous = { ...process.env };
afterEach(() => { process.env = { ...previous }; });
test("arnes manual rechaza nombre/puerto normales sin iniciar un servidor", () => {
  Object.assign(process.env, { RUN_PHASE0_MYSQL_TESTS: "1", PHASE0_TEST_DATABASE: "nexus_residencial", PHASE0_TEST_PORT: "3306" });
  expect(() => configureManualEnvironment()).toThrow("exclusivos de pruebas");
});
test("arnes manual requiere activacion explicita de infraestructura aislada", () => {
  delete process.env.RUN_PHASE0_MYSQL_TESTS;
  expect(() => configureManualEnvironment()).toThrow("exclusivos de pruebas");
});
test("sobrescribe conexion normal con base TEST y conserva credenciales solo en backend", () => {
  Object.assign(process.env, { RUN_PHASE0_MYSQL_TESTS: "1", PHASE0_TEST_DATABASE: "nexus_phase0_test_20261001_a9a8f83b", PHASE0_TEST_PORT: "20378",
    DB_NAME: "nexus_residencial", DB_PORT: "3306", RECURRENTE_SECRET_KEY: "FAKE_MANUAL_CONFIG_ONLY", RECURRENTE_SANDBOX_ID: "sbx_fixture" });
  configureManualEnvironment();
  expect(process.env.DB_NAME).toBe("nexus_phase0_test_20261001_a9a8f83b"); expect(process.env.DB_PORT).toBe("20378");
  expect(process.env.RECURRENTE_SECRET_KEY).toBe("FAKE_MANUAL_CONFIG_ONLY");
  expect(process.env.FRONTEND_ORIGIN).toBe("http://127.0.0.1:5174"); expect(process.env.PORT).toBe("3100");
  expect(process.env.EMAIL_API_URL).toBe("");
});
