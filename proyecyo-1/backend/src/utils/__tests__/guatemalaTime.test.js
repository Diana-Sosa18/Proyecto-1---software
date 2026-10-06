const { guatemalaDayRangeUtc, guatemalaToday, sqlUtcTimeToGuatemala } = require("../guatemalaTime");

describe("guatemalaTime", () => {
  it("23:30 en Guatemala sigue siendo el mismo dia aunque en UTC ya sea el siguiente", () => {
    const instant = new Date("2026-10-05T05:30:00Z"); // 2026-10-04 23:30 Guatemala
    expect(instant.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(guatemalaToday(instant)).toBe("2026-10-04");
  });

  it("00:30 en Guatemala ya es el dia nuevo", () => {
    expect(guatemalaToday(new Date("2026-10-05T06:30:00Z"))).toBe("2026-10-05");
  });

  it("calcula los limites UTC de un dia local para columnas DATETIME en UTC", () => {
    expect(guatemalaDayRangeUtc("2026-10-04")).toEqual({ start: "2026-10-04 06:00:00", end: "2026-10-05 06:00:00" });
  });

  it("convierte columnas TIME guardadas en UTC con el desfase fijo de Guatemala", () => {
    expect(sqlUtcTimeToGuatemala("ra.hora_ingreso")).toBe(
      "TIME(CONVERT_TZ(TIMESTAMP('2000-01-01', ra.hora_ingreso), '+00:00', '-06:00'))",
    );
  });
});
