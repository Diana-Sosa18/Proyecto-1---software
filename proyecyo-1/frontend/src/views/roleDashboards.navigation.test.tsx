import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import {
  getGuardNotificationsRequest,
  getGuardUnreadNotificationsRequest,
  getNotificationsRequest,
  getUnreadNotificationsRequest,
  markAllNotificationsAsReadRequest,
  markNotificationAsReadRequest,
} from "@/services/notificationsService";
import { getGuardAccessHistoryRequest, getTenantAuthorizationRequestsRequest } from "@/services/sprintStoriesService";
import { getVisitsRequest } from "@/services/visitsService";
import type { NotificationRecord } from "@/types/notifications";
import { GuardiaDashboardView } from "./GuardiaDashboardView";
import { InquilinoDashboardView } from "./InquilinoDashboardView";

// Layout real (sin mock de AppShell) para comprobar navegacion y ruta activa.
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(), getUnreadNotificationsRequest: vi.fn(),
  markAllNotificationsAsReadRequest: vi.fn(), markNotificationAsReadRequest: vi.fn(),
  getGuardNotificationsRequest: vi.fn(), getGuardUnreadNotificationsRequest: vi.fn(),
}));
vi.mock("@/services/tenantAccountService", () => ({ getTenantAccountStatementRequest: vi.fn(async () => ({ resumen: null, casa: null })) }));
vi.mock("@/services/providersService", () => ({ getTenantProvidersRequest: vi.fn(async () => []) }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn() }));
vi.mock("@/services/sprintStoriesService", () => ({
  getTenantAuthorizationRequestsRequest: vi.fn(), getGuardAccessHistoryRequest: vi.fn(),
}));

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderAt(path: string, element: JSX.Element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const notice = (id: number, leido = false): NotificationRecord => ({
  id_notificacion: id, id_usuario: 9, id_acceso: null, tipo: "COMUNICADO", titulo: `Aviso ${id}`,
  mensaje: "Mensaje", leido, creado_en: "2026-10-04 08:00:00", leido_en: leido ? "2026-10-04 09:00:00" : null,
});

describe("Dashboard del inquilino: navegación y acciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 9, email: "inquilino@test.com", role: "inquilino" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(getVisitsRequest).mockResolvedValue([]);
    vi.mocked(getTenantAuthorizationRequestsRequest).mockResolvedValue([]);
    vi.mocked(getNotificationsRequest).mockResolvedValue([notice(1), notice(2)]);
    vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 2 });
  });

  it.each([
    [/^Saldo pendiente:/, "/inquilino/estado-cuenta"],
    [/^Visitas activas:/, "/inquilino/visitas"],
    [/^Proveedores activos:/, "/inquilino/proveedores"],
    [/^Avisos no leídos:/, "/inquilino/notificaciones"],
    [/^Ver permisos$/, "/inquilino/permisos"],
    [/^Ver todas$/, "/inquilino/visitas"],
  ])("el enlace %s navega a %s", async (name, target) => {
    const user = userEvent.setup();
    renderAt("/inquilino", <InquilinoDashboardView />);
    await screen.findByText("Aviso 1");
    await user.click(screen.getByRole("link", { name }));
    expect(screen.getByTestId("location")).toHaveTextContent(target);
  });

  it("marca un aviso como leído y actualiza KPI y sidebar con el conteo real", async () => {
    const user = userEvent.setup();
    vi.mocked(markNotificationAsReadRequest).mockImplementation(async (id) => {
      vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
      return notice(id, true);
    });
    renderAt("/inquilino", <InquilinoDashboardView />);
    const sidebar = screen.getByRole("navigation", { name: "Módulos del inquilino" });
    expect(await within(sidebar).findByLabelText("2 sin leer")).toBeInTheDocument();
    await user.click((await screen.findAllByRole("button", { name: "Marcar como leida" }))[0]);
    expect(markNotificationAsReadRequest).toHaveBeenCalledWith(1);
    expect(await within(sidebar).findByLabelText("1 sin leer")).toBeInTheDocument();
    const kpi = screen.getByRole("link", { name: /^Avisos no leídos:/ });
    await waitFor(() => expect(within(kpi).getByText("1")).toBeInTheDocument());
  });

  it("marca todos los avisos y deja ambos contadores en cero", async () => {
    const user = userEvent.setup();
    vi.mocked(markAllNotificationsAsReadRequest).mockImplementation(async () => {
      vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 0 });
      return { unread: 0 };
    });
    renderAt("/inquilino", <InquilinoDashboardView />);
    const sidebar = screen.getByRole("navigation", { name: "Módulos del inquilino" });
    await within(sidebar).findByLabelText("2 sin leer");
    await user.click(screen.getByRole("button", { name: /Marcar todas/ }));
    expect(markAllNotificationsAsReadRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("No tiene notificaciones pendientes.")).toBeInTheDocument();
    await waitFor(() => expect(within(sidebar).queryByLabelText(/sin leer$/)).not.toBeInTheDocument());
    const kpi = screen.getByRole("link", { name: /^Avisos no leídos:/ });
    expect(within(kpi).getByText("Todo al día")).toBeInTheDocument();
  });
});

describe("Dashboard de guardia: navegación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 4, email: "guardia@test.com", role: "guardia" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(getGuardAccessHistoryRequest).mockResolvedValue([]);
    vi.mocked(getGuardNotificationsRequest).mockResolvedValue([]);
    vi.mocked(getGuardUnreadNotificationsRequest).mockResolvedValue({ unread: 0 });
  });

  it("marca Dashboard como activo y 'Escanear QR' navega a /guardia/control", async () => {
    const user = userEvent.setup();
    renderAt("/guardia", <GuardiaDashboardView />);
    const sidebar = screen.getByRole("navigation", { name: "Módulos del guardia" });
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("link", { name: "Escanear QR" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/guardia/control");
  });
});
