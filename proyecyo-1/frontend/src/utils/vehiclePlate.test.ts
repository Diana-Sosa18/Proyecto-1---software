import { describe, expect, it } from "vitest";

import { getVehiclePlateError, normalizeVehiclePlate } from "@/utils/vehiclePlate";

describe("validacion de placas", () => {
  it("normaliza placas guatemaltecas", () => {
    expect(normalizeVehiclePlate(" p 123 abc ")).toBe("P-123ABC");
    expect(normalizeVehiclePlate("tc-456def")).toBe("TC-456DEF");
  });

  it("acepta placa vacia y formatos alfanumericos", () => {
    expect(getVehiclePlateError("")).toBe("");
    expect(getVehiclePlateError("ABC-1234")).toBe("");
  });

  it("rechaza placas incompletas o con caracteres especiales", () => {
    expect(getVehiclePlateError("123456")).not.toBe("");
    expect(getVehiclePlateError("ABCDEF")).not.toBe("");
    expect(getVehiclePlateError("P@123ABC")).not.toBe("");
  });
});
