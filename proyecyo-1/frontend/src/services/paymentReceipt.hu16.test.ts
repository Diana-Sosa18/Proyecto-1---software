import { beforeEach, expect, it, vi } from "vitest";
import { getResidentPaymentReceiptRequest, getResidentRecurrenteReceiptsRequest, downloadPaymentReceiptRequest } from "./paymentReceiptService";
beforeEach(() => { window.localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
it("JSON usa GET autenticado sin enviar monto, estado ni identidad", async () => {
  localStorage.setItem("nexus.session", JSON.stringify({ token: "HU16_FAKE_TOKEN_ONLY" })); vi.mocked(fetch).mockResolvedValue(Response.json({ id_pago: 395 }));
  await getResidentPaymentReceiptRequest(395); const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toMatch(/\/residente\/pagos\/395\/comprobante\/datos$/); expect(options?.body).toBeUndefined(); expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer HU16_FAKE_TOKEN_ONLY");
});
it("historial consulta el catálogo local y PDF conserva endpoint existente", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(new Response("%PDF-TEST", { headers: { "Content-Type": "application/pdf" } }));
  await getResidentRecurrenteReceiptsRequest(); const blob = await downloadPaymentReceiptRequest(395);
  expect(vi.mocked(fetch).mock.calls[0][0]).toMatch(/\/residente\/pagos\/recurrente\/comprobantes$/);
  expect(vi.mocked(fetch).mock.calls[1][0]).toMatch(/\/residente\/pagos\/395\/comprobante$/); expect(blob.type).toBe("application/pdf");
});
