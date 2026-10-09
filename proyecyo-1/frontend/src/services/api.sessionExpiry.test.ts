import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiDownload, apiRequest, ApiError } from "./api";

// Solo un 401 real (token inválido, expirado o sesión cerrada) puede invalidar la sesión.
// Los errores funcionales de una operación nunca deben disparar el cierre de sesión.
describe("apiRequest y el cierre de sesión", () => {
  let expired: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    expired = vi.fn();
    window.addEventListener("nexus:session-expired", expired);
  });

  afterEach(() => {
    window.removeEventListener("nexus:session-expired", expired);
    vi.unstubAllGlobals();
  });

  it.each([400, 403, 404, 409, 422, 500])("HTTP %i se informa como error y NO cierra la sesión", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Error de la operación." }), { status }));

    await expect(apiRequest("/admin/accesos-especiales", { method: "POST", body: {} })).rejects.toMatchObject({ status });
    expect(expired).not.toHaveBeenCalled();
  });

  it("un 403 se entrega a la vista como ApiError con su mensaje (permiso denegado, no sesión expirada)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Acceso restringido a administradores." }), { status: 403 }));

    const error = await apiRequest("/admin/recordatorios/generar", { method: "POST" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect(expired).not.toHaveBeenCalled();
  });

  it("un 401 real en una ruta protegida sí notifica la sesión expirada (seguridad intacta)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "La sesion fue cerrada o expiro." }), { status: 401 }));

    await expect(apiRequest("/admin/comunicados", { method: "POST", body: {} })).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it("un 401 del propio login (credenciales inválidas) no se trata como sesión expirada", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Credenciales invalidas." }), { status: 401 }));

    await expect(apiRequest("/login", { method: "POST", body: {} })).rejects.toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
  });

  it("las descargas envían el token Bearer de la sesión y solo un 401 cierra la sesión", async () => {
    window.localStorage.setItem("nexus.session", JSON.stringify({ id: 1, role: "admin", token: "token-admin" }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response("contenido", { status: 200 }));

    await apiDownload("/admin/respaldos/1/descargar");
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-admin");
    expect(headers.get("x-user-id")).toBeNull();

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Respaldo no encontrado." }), { status: 404 }));
    await expect(apiDownload("/admin/respaldos/9/descargar")).rejects.toMatchObject({ status: 404 });
    expect(expired).not.toHaveBeenCalled();
    window.localStorage.removeItem("nexus.session");
  });
});
