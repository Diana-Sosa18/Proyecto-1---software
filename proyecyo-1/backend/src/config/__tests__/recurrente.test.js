const fs = require("node:fs");
const path = require("node:path");
const { loadRecurrenteConfig, KEYS } = require("../recurrente");
test("fase 0 arranca sin secretos y nunca habilita la pasarela", () => {
  const config = loadRecurrenteConfig({});
  expect(config).toMatchObject({ configured: false, enabled: false });
  for (const key of KEYS) expect(config[key]).toBe("");
});
test("configuracion del backend no se serializa accidentalmente", () => {
  const source = Object.fromEntries(KEYS.map((key) => [key, "test-only-placeholder"]));
  const config = loadRecurrenteConfig(source);
  expect(config.configured).toBe(true);
  expect(config.enabled).toBe(false);
  expect(config.RECURRENTE_SECRET_KEY).toBe("test-only-placeholder");
  expect(JSON.stringify(config)).not.toContain("test-only-placeholder");
  expect(Object.isFrozen(config)).toBe(true);
});
test("ejemplo contiene unicamente placeholders vacios", () => {
  const text = fs.readFileSync(path.resolve(__dirname, "../../../.env.example"), "utf8");
  for (const key of KEYS) expect(text).toMatch(new RegExp(`^${key}=\\s*$`, "m"));
  expect(text).not.toMatch(/VITE_RECURRENTE/);
});
