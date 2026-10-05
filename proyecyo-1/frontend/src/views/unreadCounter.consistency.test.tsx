import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifySidebarCountersChanged } from "@/components/layout/sidebarCounters";
import { useAuth } from "@/hooks/useAuth";
import { getNotificationsRequest, getUnreadNotificationsRequest } from "@/services/notificationsService";
import type { NotificationRecord } from "@/types/notifications";
import { InquilinoDashboardView } from "./InquilinoDashboardView";
import { ResidenteView } from "./ResidenteView";

// Sin mock de AppShell: el sidebar real y el dashboard conviven como en la app.
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(), getUnreadNotificationsRequest: vi.fn(),
  markAllNotificationsAsReadRequest: vi.fn(), markNotificationAsReadRequest: vi.fn(),
}));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(async () => ({ resumen: null, cuotas: [] })) }));
vi.mock("@/services/tenantAccountService", () => ({ getTenantAccountStatementRequest: vi.fn(async () => ({ resumen: null, casa: null })) }));
vi.mock("@/services/providersService", () => ({ getOwnerProvidersRequest: vi.fn(async () => []), getTenantProvidersRequest: vi.fn(async () => []) }));
vi.mock("@/services/amenitiesService", () => ({ getAmenitiesReservationsRequest: vi.fn(async () => []) }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn(async () => []) }));
vi.mock("@/services/sprintStoriesService", () => ({ getTenantAuthorizationRequestsRequest: vi.fn(async () => []) }));

// GET /notificaciones solo devuelve las 20 mas recientes; el total real viene del conteo.
const latestTwenty: NotificationRecord[] = Array.from({ length: 20 }, (_, index) => ({
  id_notificacion: index + 1, id_usuario: 3, id_acceso: null, tipo: "COMUNICADO", titulo: `Aviso ${index + 1}`,
  mensaje: "Mensaje", leido: false, creado_en: "2026-10-04 08:00:00", leido_en: null,
}));

const kpi = () => screen.getByRole("link", { name: /^Avisos no leídos:/ });

describe.each([
  ["residente", ResidenteView, "Módulos del residente"],
  ["inquilino", InquilinoDashboardView, "Módulos del inquilino"],
] as const)("Contador de avisos no leídos (%s)", (role, View, navName) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 3, email: `${role}@test.com`, role }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(getNotificationsRequest).mockResolvedValue(latestTwenty);
    vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 150 });
  });

  it("dashboard y sidebar muestran el mismo total real aunque el listado traiga solo 20", async () => {
    render(<MemoryRouter><View /></MemoryRouter>);
    const sidebar = screen.getByRole("navigation", { name: navName });
    expect(await within(sidebar).findByLabelText("150 sin leer")).toHaveTextContent("99+");
    await waitFor(() => expect(within(kpi()).getByText("150")).toBeInTheDocument());
    expect(within(kpi()).queryByText("20")).not.toBeInTheDocument();
    expect(await screen.findByText("Tiene 150 notificaciones pendientes.")).toBeInTheDocument();
  });

  it("ambos se recalculan juntos cuando cambia el total", async () => {
    render(<MemoryRouter><View /></MemoryRouter>);
    const sidebar = screen.getByRole("navigation", { name: navName });
    await within(sidebar).findByLabelText("150 sin leer");
    vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 7 });
    act(() => notifySidebarCountersChanged());
    expect(await within(sidebar).findByLabelText("7 sin leer")).toHaveTextContent("7");
    await waitFor(() => expect(within(kpi()).getByText("7")).toBeInTheDocument());
  });

  it("si el conteo falla, ni el sidebar ni el KPI inventan un valor", async () => {
    vi.mocked(getUnreadNotificationsRequest).mockRejectedValue(new Error("fallo"));
    render(<MemoryRouter><View /></MemoryRouter>);
    await waitFor(() => expect(within(kpi()).getByText("No disponible")).toBeInTheDocument());
    const sidebar = screen.getByRole("navigation", { name: navName });
    expect(within(sidebar).queryByLabelText(/sin leer$/)).not.toBeInTheDocument();
    // El listado limitado (20) nunca se presenta como total.
    expect(await screen.findByText("Avisos más recientes.")).toBeInTheDocument();
    expect(screen.queryByText(/Tiene 20 notificaciones/)).not.toBeInTheDocument();
  });
});
