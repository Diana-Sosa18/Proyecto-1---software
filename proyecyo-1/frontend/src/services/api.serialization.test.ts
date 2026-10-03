import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { apiRequest } from "./api";
import { payResidentObligationRequest } from "./accountService";
import { payTenantObligationRequest } from "./tenantAccountService";
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })));
  localStorage.setItem("nexus.session", JSON.stringify({ token: "test-session-token" }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
test.each([payResidentObligationRequest, payTenantObligationRequest])("pago envia un objeto JSON una sola vez y conserva autenticacion", async (pay) => {
  await pay(7);
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toMatch(/\/(residente|inquilino)\/pagos-simulados$/);
  expect(options?.body).toBe('{"id_cuota":7}');
  expect(JSON.parse(String(options?.body))).toEqual({ id_cuota: 7 });
  expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-session-token");
  expect(new Headers(options?.headers).get("Content-Type")).toBe("application/json");
});
test("conserva contratos con JSON ya serializado", async () => {
  const body = JSON.stringify({ field: "test" });
  await apiRequest("/test", { method: "POST", body });
  expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(body);
});
test.each([false, 0, null])("serializa valores JSON falsy %s", async (body) => {
  await apiRequest("/test", { method: "POST", body });
  expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(JSON.stringify(body));
});
test("GET no incluye body", async () => {
  await apiRequest("/test");
  expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBeUndefined();
});
