import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { getTenantAccountStatementRequest, payTenantObligationRequest } from "@/services/tenantAccountService";
import { InquilinoAccountView } from "./InquilinoAccountView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/tenantAccountService", () => ({ getTenantAccountStatementRequest: vi.fn(), payTenantObligationRequest: vi.fn(), downloadTenantPaymentReceiptRequest: vi.fn() }));
vi.mock("@/services/paymentReceiptService", () => ({ savePaymentReceipt: vi.fn() }));

const quota = { id_cuota: 5, id_casa: 2, casa_unidad: "B-2", servicio: "Alquiler", tipo_servicio: "Alquiler", monto: 1010, monto_base: 1000, recargo: 10, monto_pagado: 0, saldo_pendiente: 1010, fecha_limite: "2026-08-31", ultimo_pago: null, estado: "PENDIENTE" as const, es_alquiler: true };
const statement = { casa: { id_casa: 2, unidad: "B-2", propietario: "Propietario" }, resumen: { total_cuotas: 1, cuotas_pagadas: 0, cuotas_pendientes: 1, cuotas_vencidas: 0, saldo_pendiente: 1010, alquiler_pendiente: 1010, cuotas_adicionales_pendientes: 0, total_pagado: 0, proximo_vencimiento: "2026-08-31", actualizado_en: "2026-08-20T00:00:00Z" }, alquiler: [quota], cuotas_adicionales: [], pagos: [], recargos: [], periodo: { desde: null, hasta: null } };

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, "confirm").mockReturnValue(true); });

it("paga una obligación autorizada, refresca HU7/HU10 y anuncia el comprobante", async () => {
  vi.mocked(getTenantAccountStatementRequest).mockResolvedValue(statement);
  vi.mocked(payTenantObligationRequest).mockResolvedValue({ id_transaccion: 8, id_pago: 7, id_cuota: 5, concepto: "Alquiler", monto_base: 1000, recargo: 10, total: 1010, estado: "APROBADA", fecha_limite: "2026-08-31", numero_comprobante: "NXR-00000007" });
  render(<MemoryRouter><InquilinoAccountView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Pagar" }));
  await waitFor(() => expect(payTenantObligationRequest).toHaveBeenCalledWith(5));
  expect(await screen.findByText("Pago realizado")).toBeInTheDocument();
  expect(screen.getByText(/comprobante está disponible/)).toBeInTheDocument();
  expect(getTenantAccountStatementRequest).toHaveBeenCalledTimes(2);
});
