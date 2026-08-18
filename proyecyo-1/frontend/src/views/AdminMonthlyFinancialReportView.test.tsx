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
