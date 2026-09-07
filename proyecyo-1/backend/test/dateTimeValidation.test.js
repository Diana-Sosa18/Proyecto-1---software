const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureValidDate, ensureValidTime, ensureValidDateRange, ensureValidTimeRange } = require("../src/utils/dateTimeValidation");

test("HU9 valida fechas de calendario", () => {
  assert.equal(ensureValidDate("2028-02-29"), "2028-02-29");
  assert.throws(() => ensureValidDate("2026-02-29"), /fecha valida/);
  assert.throws(() => ensureValidDate("2026-13-01"), /fecha valida/);
});

test("HU9 valida horas y minutos", () => {
  assert.equal(ensureValidTime("09:05"), "09:05:00");
  assert.throws(() => ensureValidTime("24:00"), /hora valida/);
  assert.throws(() => ensureValidTime("12:60"), /hora valida/);
});

test("HU9 rechaza rangos inconsistentes", () => {
  assert.deepEqual(ensureValidDateRange("2026-01-01", "2026-01-31"), { desde: "2026-01-01", hasta: "2026-01-31" });
  assert.throws(() => ensureValidDateRange("2026-02-01", "2026-01-31"), /fecha inicial/);
  assert.throws(() => ensureValidTimeRange("18:00", "08:00"), /hora de fin/);
});
