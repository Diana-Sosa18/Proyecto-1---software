const { runName, assertOwnedSuiteDatabase, assertOwner } = require("../../../test/integration/support/suiteIsolation");
const base = "nexus_phase0_test_20261001_a9a8f83b";
const token = "01234567-89ab-4cde-8abc-0123456789ab";
const name = runName(base, token);
test("nombres propios reservan espacio para restauración sin superar 64 caracteres", () => {
  expect(name.length).toBeLessThanOrEqual(46); expect(`${name}_restore_01234567`.length).toBeLessThanOrEqual(64);
});
test.each(["nexus_residencial", `${base}_restore`, `${base}_run_012345`, "mysql", `${base};DROP DATABASE mysql`])("no adoptar base %s", (database) => {
  expect(() => runName(database, token)).toThrow();
});
test("suite puede usar únicamente su base/restore y nunca la base TEST compartida", () => {
  const env = { PHASE0_TEST_BASE_DATABASE: base, PHASE0_TEST_RUN_TOKEN: token, PHASE0_TEST_DATABASE: name };
  expect(assertOwnedSuiteDatabase(env)).toBe(name);
  expect(assertOwnedSuiteDatabase({ ...env, PHASE0_TEST_DATABASE: `${name}_restore_01234567` })).toBe(name);
  for (const wrong of [base, "nexus_residencial", `${base}_run_abcdef`, `${name}_restore`]) expect(() => assertOwnedSuiteDatabase({ ...env, PHASE0_TEST_DATABASE: wrong })).toThrow();
});
test("cleanup exige token completo, incluso con nombre de igual prefijo", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[{ base_name: base, run_token: "01234567-89ab-4cde-8abc-999999999999" }]]) };
  await expect(assertOwner(connection, name, base, token)).rejects.toThrow(/no pertenece/);
});
test("cleanup nunca consulta un destino original o ajeno", async () => {
  const connection = { execute: jest.fn() };
  for (const wrong of [base, "nexus_residencial", `${base}_run_abcdef`]) await expect(assertOwner(connection, wrong, base, token)).rejects.toThrow();
  expect(connection.execute).not.toHaveBeenCalled();
});
test("cleanup acepta exclusivamente una marca de propiedad coincidente", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[{ base_name: base, run_token: token }]]) };
  await expect(assertOwner(connection, name, base, token)).resolves.toBeUndefined();
});
test("cleanup rechaza una marca ausente sin adoptar el destino", async () => {
  const connection = { execute: jest.fn().mockResolvedValue([[]]) };
  await expect(assertOwner(connection, name, base, token)).rejects.toThrow(/no pertenece/);
});
