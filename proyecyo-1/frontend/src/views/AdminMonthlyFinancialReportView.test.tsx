import { render, screen } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import type { ReactNode } from "react";
import { AdminMonthlyFinancialReportView } from "./AdminMonthlyFinancialReportView";
import { apiRequest } from "@/services/api";
vi.mock("@/services/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({children}: {children: ReactNode}) => <main>{children}</main> }));
it("muestra métricas del reporte mensual", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ resumen:{total_cobrado:100,total_pendiente:50,total_mora:20,cantidad_pagos:1,usuarios_morosos:1}, detalle:[] });
  render(<AdminMonthlyFinancialReportView />);
  expect(await screen.findByText("Total cobrado")).toBeInTheDocument();
  expect(screen.getByText("Sin resultados para el periodo.")).toBeInTheDocument();
});
it("distingue movimientos mensuales de saldos acumulados y muestra sobrepagos", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ resumen: { total_cobrado: 20, total_pendiente: 0, total_mora: 0, cantidad_pagos: 1, usuarios_morosos: 0, sobrepago: 5, requiere_revision: true },
    detalle: [], pagos: [{ id_pago: 7, id_cuota: 4, monto_pagado: 20, fecha_pago: "2026-08-10" }] });
  render(<AdminMonthlyFinancialReportView />);
  expect(await screen.findByText("Movimientos del mes")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("sobrepago");
  expect(screen.getByText(/Pago #7/)).toHaveTextContent("2026-08-10");
  expect(screen.getByText(/Los saldos y abonos/)).toBeInTheDocument();
});
