import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "./api";

describe("apiRequest errors", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it.each([400, 401, 403, 404, 409, 422, 500])("convierte HTTP %i en ApiError", async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
    await expect(apiRequest("/fallo")).rejects.toBeInstanceOf(ApiError);
  });

  it("expone errores por campo sin mostrar detalles SQL", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ errores: [{ field: "email", message: "Correo inválido." }] }), { status: 422 }));
    await expect(apiRequest("/fallo")).rejects.toMatchObject({ fieldErrors: [{ field: "email", message: "Correo inválido." }] });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: "SQLSTATE SELECT password FROM USUARIO" }), { status: 500 }));
    await expect(apiRequest("/fallo")).rejects.toMatchObject({ message: "Ocurrió un problema en el servidor. Intenta nuevamente." });
  });

  it("mapea errores de red y notifica una sesión expirada", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(apiRequest("/fallo")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("conectar") });
    const listener = vi.fn();
    window.addEventListener("nexus:session-expired", listener, { once: true });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(apiRequest("/privado")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
  });
});
