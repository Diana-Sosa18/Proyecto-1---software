import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getAdminPaymentsRequest, getRecentPaymentsRequest } from "@/services/paymentsService";
import { AdminPaymentsView } from "./AdminPaymentsView";

vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/paymentsService", () => ({ getAdminPaymentsRequest: vi.fn(), getRecentPaymentsRequest: vi.fn() }));
const payment = { id_transaccion: 2, id_pago: 9, id_usuario: 7, usuario: "Ana Pérez", rol: "inquilino" as const, unidad: "A-2", concepto: "Alquiler", monto: 500, fecha: "2026-08-20", hora: "12:00:00", estado: "APROBADA" as const };

beforeEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.mocked(getAdminPaymentsRequest).mockResolvedValue([]); });

it("renderiza pagos recientes y aplica filtros", async () => {
  vi.mocked(getRecentPaymentsRequest).mockResolvedValue([payment]); render(<AdminPaymentsView />);
  expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
  expect(screen.getByText("A-2")).toBeInTheDocument(); expect(screen.getByText("Alquiler")).toBeInTheDocument(); expect(screen.getByText("APROBADA")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Usuario reciente"), { target: { value: "Ana" } });
  await waitFor(() => expect(getRecentPaymentsRequest).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: "Ana" })));
});

it("maneja vacío, error y vuelve a consultar mediante polling", async () => {
  vi.useFakeTimers(); vi.mocked(getRecentPaymentsRequest).mockResolvedValue([]); render(<AdminPaymentsView />);
  await act(async () => { await Promise.resolve(); }); expect(screen.getByText("No hay pagos recientes.")).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(30000); await Promise.resolve(); });
  expect(getRecentPaymentsRequest).toHaveBeenCalledTimes(2);
});
