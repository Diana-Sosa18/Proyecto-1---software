import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { getResidentAccountStatementRequest, payResidentObligationRequest } from "@/services/accountService";
import { ResidenteAccountView } from "./ResidenteAccountView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(), payResidentObligationRequest: vi.fn() }));
vi.mock("@/services/financialDetailService", () => ({ downloadResidentPaymentReceiptRequest: vi.fn() }));
vi.mock("@/services/paymentReceiptService", () => ({ savePaymentReceipt: vi.fn() }));

const pending = { resumen: { total_cuotas: 1, cuotas_pagadas: 0, cuotas_pendientes: 1, cuotas_vencidas: 0, saldo_pendiente: 115, total_pagado: 0, proximo_vencimiento: "2026-08-31", actualizado_en: "2026-08-20T12:00:00Z" }, cuotas: [{ id_cuota: 3, id_casa: 8, casa_unidad: "A-1", servicio: "Mantenimiento", tipo_servicio: "General", monto: 115, monto_base: 100, recargo: 15, monto_pagado: 0, saldo_pendiente: 115, fecha_limite: "2026-08-31", ultimo_pago: null, estado: "PENDIENTE" as const }] };
const paid = { ...pending, resumen: { ...pending.resumen, cuotas_pagadas: 1, cuotas_pendientes: 0, saldo_pendiente: 0, total_pagado: 115 }, cuotas: [{ ...pending.cuotas[0], monto_pagado: 115, saldo_pendiente: 0, estado: "PAGADA" as const }] };

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, "confirm").mockReturnValue(true); });

it("confirma el pago, refresca la cuenta y habilita el comprobante", async () => {
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValueOnce(pending).mockResolvedValueOnce(paid);
  vi.mocked(payResidentObligationRequest).mockResolvedValue({ id_transaccion: 31, id_pago: 21, id_cuota: 3, concepto: "Mantenimiento", monto_base: 100, recargo: 15, total: 115, estado: "APROBADA", fecha_limite: "2026-08-31", numero_comprobante: "NXR-00000021" });
  render(<MemoryRouter><ResidenteAccountView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Pagar" }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Pago simulado para fines académicos"));
  await waitFor(() => expect(payResidentObligationRequest).toHaveBeenCalledWith(3));
  expect(await screen.findByText("Pago realizado")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Descargar comprobante" })).toBeInTheDocument();
  expect(getResidentAccountStatementRequest).toHaveBeenCalledTimes(2);
});

it("muestra el error del pago", async () => {
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue(pending);
  vi.mocked(payResidentObligationRequest).mockRejectedValue(new Error("Pago rechazado"));
  render(<MemoryRouter><ResidenteAccountView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Pagar" }));
  expect(await screen.findByText("Pago rechazado")).toBeInTheDocument();
});
