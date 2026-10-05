import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifyResidentBadgesChanged } from "@/components/residente/residentBadges";
import { ResidentLayout } from "@/components/residente/ResidentLayout";
import { findActiveResidentNavItem } from "@/components/residente/residentNavigation";
import { useAuth } from "@/hooks/useAuth";
import { getResidentAccountStatementRequest } from "@/services/accountService";
import { getUnreadNotificationsRequest } from "@/services/notificationsService";
import { getOwnerProvidersRequest } from "@/services/providersService";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/notificationsService", () => ({ getUnreadNotificationsRequest: vi.fn() }));
vi.mock("@/services/providersService", () => ({ getOwnerProvidersRequest: vi.fn() }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn() }));

const logout = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderLayout(path = "/residente") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <ResidentLayout title="Vista" subtitle="Subtitulo">
              <LocationProbe />
            </ResidentLayout>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function sidebar() {
  return screen.getByRole("navigation", { name: "Módulos del residente" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 3, email: "residente@test.com", role: "residente" },
    logout,
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 4 });
  vi.mocked(getOwnerProvidersRequest).mockResolvedValue([{ id_servicio: 1 }, { id_servicio: 2 }] as never);
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue({
    resumen: {} as never,
    cuotas: [{ casa_unidad: "Torre A-12" }] as never,
  });
});

describe("ResidentLayout", () => {
  it("muestra marca, título de la vista y todos los módulos reales del residente", () => {
    renderLayout();
    expect(screen.getByRole("heading", { level: 1, name: "Vista" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NexusResidencial" })).toHaveAttribute("href", "/residente");
    const nav = within(sidebar());
    const expected: Array<[RegExp, string]> = [
      [/^Dashboard$/, "/residente"],
      [/^Mis visitas$/, "/residente/visitas"],
      [/^Accesos y reservas$/, "/residente/unificado"],
      [/^Amenidades$/, "/residente/amenidades"],
      [/^Proveedores/, "/residente/proveedores"],
      [/^Resumen mensual$/, "/residente/resumen-mensual"],
      [/^Mis pagos$/, "/residente/pagos"],
      [/^Cargos y pagos$/, "/residente/detalle-financiero"],
      [/^Comunicados y avisos/, "/residente/notificaciones"],
      [/^Reglamentos$/, "/residente/reglamentos"],
    ];
    for (const [name, href] of expected) {
      expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: "Sesiones activas" })).toHaveAttribute("href", "/residente/sesiones");
  });

  it("no contiene enlaces muertos ni rutas de otros roles", () => {
    renderLayout();
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("#");
      expect(href).toMatch(/^\/residente/);
    }
    expect(screen.queryByText(/Incidencias/)).not.toBeInTheDocument();
  });

  it.each([
    ["/residente", "Dashboard"],
    ["/residente/visitas", "Mis visitas"],
    ["/residente/pagos", "Mis pagos"],
    ["/residente/estado-cuenta", "Mis pagos"],
    ["/residente/pagos/retorno", "Mis pagos"],
    ["/residente/pagos/55/comprobante", "Mis pagos"],
    ["/residente/amenidades/disponibilidad-general", "Amenidades"],
    ["/residente/comunicados", "Comunicados y avisos"],
    ["/residente/proveedores", "Proveedores"],
  ])("marca como activa la opción correcta en %s", (path, label) => {
    renderLayout(path);
    const current = within(sidebar()).getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });

  it("marca sesiones activas también desde la ruta compartida", () => {
    expect(findActiveResidentNavItem("/cuenta/sesiones")?.label).toBe("Sesiones activas");
    renderLayout("/residente/sesiones");
    expect(screen.getByRole("link", { name: "Sesiones activas" })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar()).queryAllByRole("link").filter((link) => link.getAttribute("aria-current"))).toHaveLength(0);
  });

  it("navega al hacer clic en una opción del sidebar", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(within(sidebar()).getByRole("link", { name: "Mis visitas" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/residente/visitas");
    expect(within(sidebar()).getByRole("link", { name: "Mis visitas" })).toHaveAttribute("aria-current", "page");
  });

  it("muestra badges con contadores reales y la unidad del residente", async () => {
    renderLayout();
    expect(await screen.findByLabelText("4 sin leer")).toBeInTheDocument();
    expect(await screen.findByLabelText("2 pendientes")).toBeInTheDocument();
    expect(getOwnerProvidersRequest).toHaveBeenCalledWith({ status: "PENDIENTE" });
    expect(await screen.findByText("Unidad Torre A-12")).toBeInTheDocument();
    expect(screen.getByText("residente@test.com")).toBeInTheDocument();
  });

  it("no inventa badges cuando las APIs fallan o están en cero", async () => {
    vi.mocked(getUnreadNotificationsRequest).mockRejectedValue(new Error("fallo"));
    vi.mocked(getOwnerProvidersRequest).mockResolvedValue([]);
    vi.mocked(getResidentAccountStatementRequest).mockRejectedValue(new Error("fallo"));
    renderLayout();
    await waitFor(() => expect(getOwnerProvidersRequest).toHaveBeenCalled());
    await waitFor(() => expect(getUnreadNotificationsRequest).toHaveBeenCalled());
    expect(screen.queryByLabelText(/sin leer$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pendientes$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Unidad /)).not.toBeInTheDocument();
  });

  it("recalcula los badges cuando otra vista notifica cambios", async () => {
    renderLayout();
    expect(await screen.findByLabelText("4 sin leer")).toBeInTheDocument();
    vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
    act(() => notifyResidentBadgesChanged());
    expect(await screen.findByLabelText("1 sin leer")).toBeInTheDocument();
  });

  it("cierra sesión desde el sidebar", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("abre y cierra el menú móvil con botón y tecla Escape", async () => {
    const user = userEvent.setup();
    renderLayout();
    const toggle = screen.getByRole("button", { name: "Abrir menú" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("sidebar-drawer-backdrop")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("sidebar-drawer-backdrop")).not.toBeInTheDocument();
  });

  it("cierra el menú móvil al navegar", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    await user.click(within(sidebar()).getByRole("link", { name: "Reglamentos" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/residente/reglamentos");
    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  });
});
