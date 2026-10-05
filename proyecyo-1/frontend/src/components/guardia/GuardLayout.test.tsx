import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuardLayout } from "@/components/guardia/GuardLayout";
import { useAuth } from "@/hooks/useAuth";
import { getGuardUnreadNotificationsRequest } from "@/services/notificationsService";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/notificationsService", () => ({ getGuardUnreadNotificationsRequest: vi.fn() }));

const logout = vi.fn();

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderLayout(path = "/guardia") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<GuardLayout title="Vista" subtitle="Sub"><LocationProbe /></GuardLayout>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sidebar = () => screen.getByRole("navigation", { name: "Módulos del guardia" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 4, email: "guardia@test.com", role: "guardia" }, logout } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(getGuardUnreadNotificationsRequest).mockResolvedValue({ unread: 2 });
});

describe("GuardLayout", () => {
  it("prioriza las operaciones de garita y no incluye finanzas ni módulos de otros roles", () => {
    renderLayout();
    expect(screen.getByText("Panel de Guardia")).toBeInTheDocument();
    const nav = within(sidebar());
    const expected: Array<[RegExp, string]> = [
      [/^Dashboard$/, "/guardia"],
      [/^Control de acceso$/, "/guardia/control"],
      [/^Visitas recientes$/, "/guardia/visitas"],
      [/^Historial de accesos$/, "/guardia/historial"],
      [/^Alertas/, "/guardia/alertas"],
    ];
    expect(nav.getAllByRole("link")).toHaveLength(expected.length);
    for (const [name, href] of expected) {
      expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.queryByText("Finanzas")).not.toBeInTheDocument();
    expect(screen.queryByText(/pagos|estado de cuenta/i)).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/guardia/);
    }
    expect(screen.getByRole("link", { name: "Sesiones activas" })).toHaveAttribute("href", "/guardia/sesiones");
  });

  it.each([
    ["/guardia", "Dashboard"],
    ["/guardia/control", "Control de acceso"],
    ["/guardia/historial", "Historial de accesos"],
    ["/guardia/alertas", "Alertas"],
  ])("marca como activa la opción correcta en %s", (path, label) => {
    renderLayout(path);
    const current = within(sidebar()).getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });

  it("muestra el badge real de alertas sin leer y lo oculta si la API falla", async () => {
    const { unmount } = renderLayout();
    expect(await screen.findByLabelText("2 sin leer")).toBeInTheDocument();
    unmount();
    vi.mocked(getGuardUnreadNotificationsRequest).mockRejectedValue(new Error("fallo"));
    renderLayout();
    await waitFor(() => expect(getGuardUnreadNotificationsRequest).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText(/sin leer$/)).not.toBeInTheDocument();
  });

  it("navega desde el sidebar y cierra sesión", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(within(sidebar()).getByRole("link", { name: "Control de acceso" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/guardia/control");
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
