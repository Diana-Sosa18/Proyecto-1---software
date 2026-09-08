import { describe, expect, it } from "vitest";
import { isValidDate, isValidTime, validateDateRange, validateTimeRange } from "./dateTimeValidation";

describe("HU9 - fechas y horarios", () => {
  it("rechaza fechas inexistentes", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
  });
  it("rechaza horas fuera de rango", () => {
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
  });
  it("explica rangos inconsistentes", () => {
    expect(validateDateRange("2026-02-02", "2026-02-01")).toMatch(/fecha inicial/);
    expect(validateTimeRange("18:00", "08:00")).toMatch(/hora de fin/);
  });
});
