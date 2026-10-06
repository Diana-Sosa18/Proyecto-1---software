import { describe, expect, it } from "vitest";

import { formatUtcTimestamp, guatemalaToday, parseUtcTimestamp } from "./guatemalaTime";

describe("guatemalaTime", () => {
  it("23:30 en Guatemala sigue siendo el mismo día aunque en UTC ya sea el siguiente", () => {
    const instant = new Date("2026-10-05T05:30:00Z"); // 2026-10-04 23:30 Guatemala
    expect(instant.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(guatemalaToday(0, instant)).toBe("2026-10-04");
  });

  it("00:30 en Guatemala ya es el día nuevo", () => {
    expect(guatemalaToday(0, new Date("2026-10-05T06:30:00Z"))).toBe("2026-10-05");
  });

  it("suma días sobre la fecha local, también al cambiar de mes", () => {
    const instant = new Date("2026-11-01T05:30:00Z"); // 2026-10-31 23:30 Guatemala
    expect(guatemalaToday(1, instant)).toBe("2026-11-01");
    expect(guatemalaToday(30, instant)).toBe("2026-11-30");
  });

  it("interpreta los timestamps sin zona del backend como UTC", () => {
    expect(parseUtcTimestamp("2026-10-05 06:03:10")?.toISOString()).toBe("2026-10-05T06:03:10.000Z");
    expect(parseUtcTimestamp("2026-10-05T06:03:10Z")?.toISOString()).toBe("2026-10-05T06:03:10.000Z");
    expect(parseUtcTimestamp("")).toBeNull();
  });

  it("muestra un instante UTC en hora de Guatemala (no 6 horas adelantado)", () => {
    // 06:03 UTC son las 00:03 del mismo día en Guatemala.
    const shown = formatUtcTimestamp("2026-10-05 06:03:10", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(shown).toBe("00:03");
    const withDate = formatUtcTimestamp("2026-10-05 05:30:00", { year: "numeric", month: "2-digit", day: "2-digit" });
    expect(withDate).toBe("04/10/2026");
  });

  it("devuelve el valor original si no es una fecha", () => {
    expect(formatUtcTimestamp("sin fecha")).toBe("sin fecha");
  });
});
