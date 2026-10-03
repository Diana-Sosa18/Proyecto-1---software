import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ResidentePaymentReturnView } from "./ResidentePaymentReturnView";
import { ResidenteAccountView } from "./ResidenteAccountView";
import { getResidentAccountStatementRequest, payResidentObligationRequest } from "@/services/accountService";
import { createResidentCheckoutRequest } from "@/services/recurrenteCheckoutService";
vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(), payResidentObligationRequest: vi.fn() }));
vi.mock("@/services/recurrenteCheckoutService", () => ({ createResidentCheckoutRequest: vi.fn(), redirectToRecurrente: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("retorno con status paid sigue pendiente y permite volver a la cuenta", () => {
  render(<MemoryRouter initialEntries={["/residente/pagos/retorno?status=paid&referencia=test"]}><Routes>
    <Route path="/residente/pagos/retorno" element={<ResidentePaymentReturnView />} />
    <Route path="/residente/estado-cuenta" element={<p>Cuenta de prueba</p>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText("Tu pago está pendiente de verificación")).toBeInTheDocument();
  expect(screen.queryByText("Pago realizado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Volver al estado de cuenta" }));
  expect(screen.getByText("Cuenta de prueba")).toBeInTheDocument();
});
it.each(["?status=succeeded&paid=true&amount=0", "?success=true&payment_id=TEST"])(
  "parametros %s no confirman ni llaman a servicios financieros", (query) => {
    render(<MemoryRouter initialEntries={[`/residente/pagos/retorno${query}`]}><ResidentePaymentReturnView /></MemoryRouter>);
    expect(screen.queryByText("Pago realizado")).not.toBeInTheDocument();
    expect(getResidentAccountStatementRequest).not.toHaveBeenCalled();
    expect(payResidentObligationRequest).not.toHaveBeenCalled();
    expect(createResidentCheckoutRequest).not.toHaveBeenCalled();
  },
);
it("volver consulta saldo confirmado desde backend sin inventar confirmacion local", async () => {
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue({
    resumen: { total_cuotas: 1, cuotas_pagadas: 1, cuotas_pendientes: 0, cuotas_vencidas: 0,
      saldo_pendiente: 0, total_pagado: 115, proximo_vencimiento: null, actualizado_en: "2026-08-01T06:00:00Z" },
    cuotas: [{ id_cuota: 3, id_casa: 1, casa_unidad: "A-1", servicio: "Cuota confirmada por backend",
      tipo_servicio: "General", monto: 115, monto_base: 100, recargo: 15, monto_pagado: 115,
      saldo_pendiente: 0, fecha_limite: "2026-08-01", ultimo_pago: "2026-07-31", estado: "PAGADA" }],
  });
  render(<MemoryRouter initialEntries={["/residente/pagos/retorno?status=paid"]}><Routes>
    <Route path="/residente/pagos/retorno" element={<ResidentePaymentReturnView />} />
    <Route path="/residente/estado-cuenta" element={<ResidenteAccountView />} />
  </Routes></MemoryRouter>);
  expect(getResidentAccountStatementRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Volver al estado de cuenta" }));
  await screen.findByText("Cuota confirmada por backend");
  await waitFor(() => expect(getResidentAccountStatementRequest).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  expect(payResidentObligationRequest).not.toHaveBeenCalled(); expect(createResidentCheckoutRequest).not.toHaveBeenCalled();
});
