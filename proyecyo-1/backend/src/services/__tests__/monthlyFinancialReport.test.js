const { __private__ } = require("../adminPaymentsService");
test("valida mes y anio del reporte mensual", () => {
  expect(__private__.normalizePeriod(8, 2026)).toEqual({ month: 8, year: 2026, from: "2026-08-01" });
  expect(() => __private__.normalizePeriod(13, 2026)).toThrow(/invalido/);
});
