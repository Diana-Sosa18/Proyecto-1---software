import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ResidentePaymentReturnView } from "./ResidentePaymentReturnView";
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
