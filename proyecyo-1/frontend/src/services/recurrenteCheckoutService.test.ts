import { afterEach, expect, test, vi } from "vitest";
import { createResidentCheckoutRequest, redirectToRecurrente, getResidentCheckoutStatusRequest, retryResidentCheckoutRequest } from "./recurrenteCheckoutService";

test("estado se consulta sin crear checkout ni enviar monto/secretos", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ estado: "FALLIDO", accion: "CONTINUAR" })));
  await getResidentCheckoutStatusRequest("opaque-reference"); const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toMatch(/\/checkouts\/opaque-reference$/); expect(options?.body).toBeUndefined();
  expect(new Headers(options?.headers).has("X-SECRET-KEY")).toBe(false);
});
test("retry envía solo referencia local y no llama endpoint simulado", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ referencia_local: "opaque-reference", checkout_url: "https://app.recurrente.com/checkout-session/ch_TEST" })));
  await retryResidentCheckoutRequest("opaque-reference"); const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toMatch(/\/recurrente\/reintentar$/); expect(options?.body).toBe('{"referencia_local":"opaque-reference"}');
  expect(new Headers(options?.headers).has("X-SECRET-KEY")).toBe(false);
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
test("solo envia cuota y Bearer al endpoint real, sin monto ni llave", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ referencia_local: "test", checkout_url: "https://app.recurrente.com/checkout-session/ch_test" }), { status: 201 })));
  localStorage.setItem("nexus.session", JSON.stringify({ token: "signed-test-session" }));
  await createResidentCheckoutRequest(3);
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toMatch(/\/residente\/pagos\/recurrente\/checkout$/);
  expect(options?.body).toBe('{"id_cuota":3}');
  expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer signed-test-session");
  expect(new Headers(options?.headers).has("X-SECRET-KEY")).toBe(false);
});
test("redirecciona solo a URL hospedada validada", () => {
  const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
  redirectToRecurrente("https://app.recurrente.com/checkout-session/ch_test");
  expect(assign).toHaveBeenCalledWith("https://app.recurrente.com/checkout-session/ch_test");
});
test.each(["http://app.recurrente.com/checkout-session/ch_test", "https://evil.test/checkout-session/ch_test",
  "https://app.recurrente.com.evil.test/checkout-session/ch_test", "https://user@app.recurrente.com/checkout-session/ch_test",
  "https://app.recurrente.com:444/checkout-session/ch_test", "https://app.recurrente.com/checkout-session/ch_test?next=evil",
  "https://app.recurrente.com/checkout-session/ch_test#hash", "javascript:alert(1)", "https://app.recurrente.com/other",
  "https://app.recurrente.com/checkout-session/ch_test\n"]) ("bloquea redireccion insegura %s", (url) => {
  const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
  expect(() => redirectToRecurrente(url)).toThrow("dirección válida"); expect(assign).not.toHaveBeenCalled();
});
