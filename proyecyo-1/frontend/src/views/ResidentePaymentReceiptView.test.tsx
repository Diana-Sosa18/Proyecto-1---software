import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api";
import { getResidentPaymentReceiptRequest, getResidentRecurrenteReceiptsRequest, downloadPaymentReceiptRequest, savePaymentReceipt } from "@/services/paymentReceiptService";
import { getResidentAccountStatementRequest } from "@/services/accountService";
import { ResidentePaymentReceiptView } from "./ResidentePaymentReceiptView";
import { ResidenteAccountView } from "./ResidenteAccountView";
import type { PaymentReceipt } from "@/types/paymentReceipt";
vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn() }));
vi.mock("@/services/paymentReceiptService", async (importOriginal) => ({ ...await importOriginal<typeof import("@/services/paymentReceiptService")>(),
  getResidentPaymentReceiptRequest: vi.fn(), getResidentRecurrenteReceiptsRequest: vi.fn(), downloadPaymentReceiptRequest: vi.fn(), savePaymentReceipt: vi.fn() }));
const receipt: PaymentReceipt = { id_pago: 395, id_cuota: 171, numero_comprobante: "NXR-00000395", servicio: "HU13 Sandbox Q5 TEST", monto_pagado: 5,
  fecha_pago: "2026-10-02", titular_nombre: "Residente Demo", unidad: "B-302", estado: "CONFIRMADO", moneda: "GTQ", proveedor: "Recurrente",
  origen: "RECURRENTE", ambiente: "sandbox", id_transaccion: 296, id_checkout: 433, referencia_transaccion: "in_y4hil51d" };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getResidentPaymentReceiptRequest).mockResolvedValue(receipt); vi.mocked(getResidentRecurrenteReceiptsRequest).mockResolvedValue([receipt]); });
const mount = (id = "395") => render(<MemoryRouter initialEntries={[`/residente/pagos/${id}/comprobante`]}><Routes>
  <Route path="/residente/pagos/:paymentId/comprobante" element={<ResidentePaymentReceiptView />} />
  <Route path="/residente/estado-cuenta" element={<p>Estado de cuenta TEST</p>} />
</Routes></MemoryRouter>);
it("comprobante permanente muestra refund y neto cero conservando número, fecha y PDF", async () => {
  vi.mocked(getResidentPaymentReceiptRequest).mockResolvedValue({ ...receipt, reembolsado: 5, abono_neto: 0, reembolso_posterior: true, estado_transaccion: 'REEMBOLSADA' });
  mount(); await screen.findByText('Reembolsado');
  expect(screen.getByText('NXR-00000395')).toBeInTheDocument(); expect(screen.getByText('2026-10-02')).toBeInTheDocument();
  expect(screen.getAllByText('Q5.00')).toHaveLength(2); expect(screen.getByText('Q0.00')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
});
it("muestra carga y después los datos confirmados con Sandbox visible", async () => {
  let resolve!: (r: PaymentReceipt) => void; vi.mocked(getResidentPaymentReceiptRequest).mockReturnValue(new Promise((r) => { resolve = r; }));
  mount(); expect(screen.getByRole("status")).toHaveTextContent("Cargando comprobante"); expect(screen.queryByRole("button", { name: "Descargar PDF" })).not.toBeInTheDocument();
  await act(async () => resolve(receipt));
  for (const value of ["COMPROBANTE DE PAGO", "NXR-00000395", "2026-10-02", "Confirmado", "Q5.00", "GTQ", "Recurrente", "Residente Demo", "B-302", "in_y4hil51d", "Sandbox / Prueba"]) expect(screen.getByText(value)).toBeInTheDocument();
  expect(getResidentPaymentReceiptRequest).toHaveBeenCalledWith(395);
});
it.each([
  [401, "Inicia sesión"], [403, "No tienes autorización"], [404, "No se encontró"], [409, "no tiene un pago confirmado"], [500, "No fue posible"],
])("error %s seguro, sin descargar ni mostrar detalles crudos", async (status, text) => {
  vi.mocked(getResidentPaymentReceiptRequest).mockRejectedValue(new ApiError("PRIVATE_PROVIDER_TEST_STACK", status)); mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(text); expect(screen.queryByText("PRIVATE_PROVIDER_TEST_STACK")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Descargar PDF" })).not.toBeInTheDocument(); expect(downloadPaymentReceiptRequest).not.toHaveBeenCalled();
});
it("PDF usa únicamente id_pago autoritativo, carga y evita doble clic", async () => {
  let resolve!: (b: Blob) => void; vi.mocked(downloadPaymentReceiptRequest).mockReturnValue(new Promise((r) => { resolve = r; }));
  mount(); const button = await screen.findByRole("button", { name: "Descargar PDF" }); fireEvent.click(button); fireEvent.click(button);
  expect(downloadPaymentReceiptRequest).toHaveBeenCalledTimes(1); expect(downloadPaymentReceiptRequest).toHaveBeenCalledWith(395);
  expect(screen.getByRole("button", { name: "Descargando comprobante…" })).toBeDisabled();
  const blob = new Blob(["%PDF-TEST"], { type: "application/pdf" }); await act(async () => resolve(blob));
  expect(savePaymentReceipt).toHaveBeenCalledWith(blob, "NXR-00000395");
});
it("error PDF muestra mensaje seguro sin guardar archivo", async () => {
  vi.mocked(downloadPaymentReceiptRequest).mockRejectedValue(new Error("PRIVATE_SQL_TEST")); mount(); fireEvent.click(await screen.findByRole("button", { name: "Descargar PDF" }));
  expect(await screen.findByText("No fue posible consultar o descargar el comprobante. Intenta nuevamente.")).toBeInTheDocument(); expect(savePaymentReceipt).not.toHaveBeenCalled(); expect(screen.queryByText("PRIVATE_SQL_TEST")).not.toBeInTheDocument();
});
it("ID de ruta inválido no consulta backend", async () => { mount("invalid"); await screen.findByText("No se encontró el comprobante solicitado."); expect(getResidentPaymentReceiptRequest).not.toHaveBeenCalled(); });
it("volver abre el Estado de cuenta", async () => { mount(); await screen.findByText("NXR-00000395"); fireEvent.click(screen.getByRole("button", { name: "Volver al estado de cuenta" })); expect(screen.getByText("Estado de cuenta TEST")).toBeInTheDocument(); });
it("Estado de cuenta permite visualizar el comprobante real confirmado", async () => {
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue({ resumen: { total_cuotas: 1, cuotas_pagadas: 1, cuotas_pendientes: 0, cuotas_vencidas: 0, saldo_pendiente: 0,
    total_pagado: 5, proximo_vencimiento: null, actualizado_en: "2026-10-02T19:00:00Z" }, cuotas: [{ id_cuota: 171, id_casa: 1, casa_unidad: "B-302", servicio: receipt.servicio,
      tipo_servicio: "General", monto: 5, monto_base: 5, recargo: 0, monto_pagado: 5, saldo_pendiente: 0, fecha_limite: "2026-10-09", ultimo_pago: receipt.fecha_pago, estado: "PAGADA" }] });
  render(<MemoryRouter initialEntries={["/residente/estado-cuenta"]}><Routes><Route path="/residente/estado-cuenta" element={<ResidenteAccountView />} />
    <Route path="/residente/pagos/:paymentId/comprobante" element={<ResidentePaymentReceiptView />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Ver comprobante NXR-00000395" })); await screen.findByText("COMPROBANTE DE PAGO");
  expect(getResidentPaymentReceiptRequest).toHaveBeenCalledWith(395);
});
