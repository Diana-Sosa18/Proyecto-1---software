import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getResidentAccountStatementRequest } from "@/services/accountService";
import { getFinancialDetailRequest } from "@/services/financialDetailService";
import type { AccountQuotaStatus } from "@/types/account";
import { ResidenteAccountView } from "./ResidenteAccountView";
import { ResidenteFinancialDetailView } from "./ResidenteFinancialDetailView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(), payResidentObligationRequest: vi.fn() }));
vi.mock("@/services/recurrenteCheckoutService", () => ({ createResidentCheckoutRequest: vi.fn(), redirectToRecurrente: vi.fn() }));
vi.mock("@/services/financialDetailService", () => ({ getFinancialDetailRequest: vi.fn(), downloadResidentPaymentReceiptRequest: vi.fn() }));

// La misma cuota, tal como la devuelve el backend a cada vista (estado ya calculado por la regla unica).
const quota = { id_cuota: 1211, servicio: "Cuota de mantenimiento", monto: 400, recargo: 20, saldo: 420, fecha_limite: "2026-09-25" };

function mockBoth(estado: AccountQuotaStatus, pagoParcial = false) {
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue({
    resumen: { total_cuotas: 1, cuotas_pagadas: 0, cuotas_pendientes: 0, cuotas_vencidas: 1, saldo_pendiente: quota.saldo, total_pagado: 0, proximo_vencimiento: null, actualizado_en: "2026-10-05T12:00:00Z" },
    cuotas: [{ id_cuota: quota.id_cuota, id_casa: 2, casa_unidad: "H32-101", servicio: quota.servicio, tipo_servicio: "Mantenimiento", monto: 420, monto_base: 400, recargo: 20,
      monto_pagado: 0, saldo_pendiente: quota.saldo, fecha_limite: quota.fecha_limite, ultimo_pago: null, estado }],
  } as never);
  vi.mocked(getFinancialDetailRequest).mockResolvedValue({
    unidad: "H32-101", periodo: { desde: null, hasta: null },
    resumen: { total_cargos: 400, total_recargos: 20, total_pagado: 0, saldo_pendiente: quota.saldo },
    cargos: [{ ...quota, pagado: 0, estado, pago_parcial: pagoParcial }], recargos: [], pagos: [], reembolsos: [],
  } as never);
}

// Etiquetas de estado (texto exacto) que la vista muestra para la cuota.
async function labelsIn(view: ReactNode) {
  const { unmount } = render(<MemoryRouter>{view}</MemoryRouter>);
  await screen.findAllByText(quota.servicio);
  const labels = ["Vencida", "Pendiente", "Pagada"].filter((text) => screen.queryAllByText(text).length > 0);
  unmount();
  return labels;
}

beforeEach(() => vi.resetAllMocks());

describe("HU32 Mis pagos y Cargos y pagos muestran el mismo estado", () => {
  it.each<[AccountQuotaStatus, string]>([["VENCIDA", "Vencida"], ["PENDIENTE", "Pendiente"], ["PAGADA", "Pagada"]])(
    "estado %s se presenta como %s en ambas vistas", async (estado, etiqueta) => {
      mockBoth(estado);
      expect(await labelsIn(<ResidenteAccountView />)).toEqual([etiqueta]);
      expect(await labelsIn(<ResidenteFinancialDetailView />)).toEqual([etiqueta]);
    });

  it("el pago parcial se muestra aparte, sin reemplazar el estado", async () => {
    mockBoth("VENCIDA", true);
    render(<MemoryRouter><ResidenteFinancialDetailView /></MemoryRouter>);
    const row = (await screen.findByText(quota.servicio)).closest("tr") as HTMLElement;
    expect(within(row).getByText("Vencida")).toBeInTheDocument();
    expect(within(row).getByText("Pago parcial")).toBeInTheDocument();
    expect(within(row).queryByText("Parcial")).not.toBeInTheDocument();
  });
});
