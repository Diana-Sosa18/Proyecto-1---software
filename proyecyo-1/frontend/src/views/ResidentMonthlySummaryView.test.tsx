import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "@/services/api";
import { ResidentMonthlySummaryView } from "./ResidentMonthlySummaryView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/api", () => ({ apiRequest: vi.fn() }));

const summary = {
  visitas: { total: 3 }, accesos: { total: 5 }, reservas: { total: 2, amenidades_utilizadas: 1 },
  actividades_recientes: [{ fecha: "2026-10-02", tipo: "VISITA", detalle: "Ana López" }],
};

// Un mes distinto al actual para que el cambio siempre dispare una nueva consulta.
const otherMonth = String(((new Date().getMonth() + 1) % 12) + 1);

beforeEach(() => vi.clearAllMocks());

it("muestra el resumen real y consulta el mes elegido", async () => {
  vi.mocked(apiRequest).mockResolvedValue(summary);
  render(<MemoryRouter><ResidentMonthlySummaryView /></MemoryRouter>);
  expect(await screen.findByText("Ana López")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: otherMonth } });
  await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(expect.stringContaining(`?month=${otherMonth}&year=`)));
  expect(screen.getByLabelText("Año")).toBeInTheDocument();
});

it("muestra estado vacío y errores", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...summary, actividades_recientes: [] });
  render(<MemoryRouter><ResidentMonthlySummaryView /></MemoryRouter>);
  expect(await screen.findByText("Sin actividad en este mes.")).toBeInTheDocument();
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Servicio no disponible"));
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: otherMonth } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
});
