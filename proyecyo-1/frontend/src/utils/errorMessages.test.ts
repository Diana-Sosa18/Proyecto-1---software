import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getErrorMessage, getFieldErrors } from "./errorMessages";

describe("mensajes de error", () => {
  it.each([
    [400, "Revisa la información ingresada."],
    [401, "Tu sesión ha expirado. Inicia sesión nuevamente."],
    [403, "No tienes permisos para realizar esta acción."],
    [404, "No se encontró la información solicitada."],
    [409, "Ya existe un registro con esta información."],
    [500, "Ocurrió un problema en el servidor. Intenta nuevamente."],
  ])("mapea HTTP %i", (status, expected) => expect(getApiErrorMessage(status, null)).toBe(expected));

  it("conserva mensajes de negocio y extrae errores por campo", () => {
    const payload = { errores: [{ field: "email", message: "El correo ya está registrado." }] };
    expect(getApiErrorMessage(422, payload)).toBe("El correo ya está registrado.");
    expect(getFieldErrors(payload)).toEqual([{ field: "email", message: "El correo ya está registrado." }]);
  });

  it("oculta detalles técnicos y valores que no son errores", () => {
    expect(getApiErrorMessage(500, { message: "SQLSTATE SELECT * FROM USUARIO" })).toBe("Ocurrió un problema en el servidor. Intenta nuevamente.");
    expect(getErrorMessage({ message: "[object Object]" }, "Error seguro")).toBe("Error seguro");
  });
});
