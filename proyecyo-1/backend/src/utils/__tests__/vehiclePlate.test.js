const {
  ensureValidVehiclePlate,
  normalizeVehiclePlate,
  validateVehiclePlate,
} = require("../vehiclePlate");

describe("validacion de placas de vehiculos", () => {
  test("normaliza mayusculas, espacios y placas guatemaltecas", () => {
    expect(normalizeVehiclePlate(" p 123 abc ")).toBe("P-123ABC");
    expect(normalizeVehiclePlate("tc-456def")).toBe("TC-456DEF");
  });

  test("permite una placa vacia porque el vehiculo es opcional", () => {
    expect(validateVehiclePlate("   ")).toEqual({ value: "", error: null });
    expect(ensureValidVehiclePlate(undefined)).toBe("");
  });

  test("acepta formatos alfanumericos no guatemaltecos dentro del limite", () => {
    expect(validateVehiclePlate("ABC-1234")).toEqual({
      value: "ABC1234",
      error: null,
    });
  });

  test.each(["123456", "ABCDEF", "P@123ABC", "A1", "ABCDEFGHIJKLM1"])(
    "rechaza la placa invalida %s",
    (plate) => {
      try {
        ensureValidVehiclePlate(plate);
        throw new Error("La validacion debio rechazar la placa.");
      } catch (error) {
        expect(error).toMatchObject({
          status: 400,
          code: "INVALID_VEHICLE_PLATE",
        });
      }
    },
  );
});
