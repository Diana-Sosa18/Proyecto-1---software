import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminReportsView } from "./AdminReportsView";
import { downloadReport } from "@/services/reportExportService";
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/services/reportExportService", () => ({ downloadReport: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it("HU10 exporta el reporte, formato y período elegidos", async () => {
  vi.mocked(downloadReport).mockResolvedValue();
  render(<AdminReportsView />);
  fireEvent.change(screen.getByLabelText("Reporte"), { target: { value: "reservas" } });
  fireEvent.change(screen.getByLabelText("Formato"), { target: { value: "xlsx" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-07" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith({ reporte: "reservas", formato: "xlsx", desde: "2026-09-01", hasta: "2026-09-07" }));
});

it("HU10 muestra errores de exportación y permite reintentar", async () => {
  vi.mocked(downloadReport).mockRejectedValue(new Error("Reduzca el período"));
  render(<AdminReportsView />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reduzca el período");
  expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
});
