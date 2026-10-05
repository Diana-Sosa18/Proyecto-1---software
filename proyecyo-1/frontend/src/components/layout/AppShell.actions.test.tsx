import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/notificationsService", () => ({
  getUnreadNotificationsRequest: vi.fn(async () => ({ unread: 0 })),
  getGuardUnreadNotificationsRequest: vi.fn(async () => ({ unread: 0 })),
}));
vi.mock("@/services/tenantAccountService", () => ({ getTenantAccountStatementRequest: vi.fn(async () => ({ casa: null })) }));
vi.mock("@/services/providersService", () => ({ getOwnerProvidersRequest: vi.fn(async () => []) }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(async () => ({ resumen: null, cuotas: [] })) }));

describe("AppShell actions", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 3, email: "residente@nexus.test", role: "residente" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  });

  it("usa el layout de residente con sidebar y no ofrece navegación a roles no autorizados", () => {
    render(<MemoryRouter><AppShell role="residente" title="Inicio" subtitle="Panel"><p>Contenido</p></AppShell></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(screen.getByRole("navigation", { name: "Módulos del residente" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administrador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Guardia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inquilino" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^\/(admin|guardia|inquilino)/);
    }
  });

  it("mantiene el shell anterior para roles sin layout propio (admin)", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 4, email: "admin@nexus.test", role: "admin" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<MemoryRouter><AppShell role="admin" title="Inicio" subtitle="Panel"><p>Contenido</p></AppShell></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Salir" })).toBeEnabled();
    expect(screen.getByText("Panel autorizado")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Módulos del residente" })).not.toBeInTheDocument();
  });

  it.each([
    ["inquilino", "Módulos del inquilino", "/inquilino"],
    ["guardia", "Módulos del guardia", "/guardia"],
  ] as const)("usa el layout con sidebar de %s y solo enlaza a su propio panel", (role, navName, prefix) => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 5, email: `${role}@nexus.test`, role }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<MemoryRouter><AppShell role={role} title="Inicio" subtitle="Panel"><p>Contenido</p></AppShell></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: navName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")?.startsWith(prefix)).toBe(true);
    }
  });
});
