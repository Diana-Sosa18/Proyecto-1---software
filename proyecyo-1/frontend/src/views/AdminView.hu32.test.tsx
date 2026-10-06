import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAdminAccessesRequest,
  getAdminAccessHourlyChartRequest,
  getAdminAccessSummaryRequest,
} from "@/services/adminAccessesService";
import { getAdminAmenityStatsRequest } from "@/services/amenitiesService";
import { AdminView } from "./AdminView";

vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/admin/UsersManagement", () => ({ UsersManagement: () => null }));
vi.mock("@/services/adminAccessesService", () => ({
  getAdminAccessesRequest: vi.fn(), getAdminAccessHourlyChartRequest: vi.fn(), getAdminAccessSummaryRequest: vi.fn(),
}));
vi.mock("@/services/amenitiesService", () => ({ getAdminAmenityStatsRequest: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminAccessSummaryRequest).mockResolvedValue({ total_dia: 7, aprobados: 4, pendientes: 2, rechazados: 1 });
  vi.mocked(getAdminAccessHourlyChartRequest).mockResolvedValue([]);
  vi.mocked(getAdminAccessesRequest).mockResolvedValue([]);
  vi.mocked(getAdminAmenityStatsRequest).mockResolvedValue({ por_amenidad: [], ranking: [] } as never);
});

const renderView = () => render(<MemoryRouter><AdminView /></MemoryRouter>);

describe("HU32 Dashboard de administración", () => {
  it("no muestra tarjetas decorativas: solo accesos directos a módulos reales", async () => {
    renderView();
    await screen.findByText("Sin reservas en el rango.");
    expect(screen.queryByText("Mantenimiento")).not.toBeInTheDocument();
    expect(screen.queryByText(/mismo lenguaje visual/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Monitoreo de accesos/ })).toHaveAttribute("href", "/admin/accesos");
    expect(screen.getByRole("link", { name: /Reservas de amenidades/ })).toHaveAttribute("href", "/admin/amenidades");
  });

  it("los KPIs vienen del backend", async () => {
    renderView();
    const card = (await screen.findByText("Accesos Hoy")).closest("article") ?? document.body;
    await waitFor(() => expect(within(card as HTMLElement).getByText("7")).toBeInTheDocument());
  });

  it("un fallo de estadísticas de amenidades se muestra como error, no como 'Sin reservas'", async () => {
    vi.mocked(getAdminAmenityStatsRequest).mockRejectedValue(new Error("Estadísticas no disponibles"));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("Estadísticas no disponibles");
    expect(screen.queryByText("Sin reservas en el rango.")).not.toBeInTheDocument();
  });

  it("el rango por defecto es el día de Guatemala, no el día UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T05:30:00Z")); // 23:30 del 4 en Guatemala
    try {
      renderView();
      await waitFor(() => expect(getAdminAmenityStatsRequest).toHaveBeenCalledWith({ from: "2026-10-04", to: "2026-10-04" }));
    } finally {
      vi.useRealTimers();
    }
  });
});
