import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 3, email: "residente@nexus.test", role: "residente" }, logout: vi.fn() }),
}));

describe("AppShell actions", () => {
  it("muestra acciones funcionales y no ofrece navegación a roles no autorizados", () => {
    render(<MemoryRouter><AppShell role="residente" title="Inicio" subtitle="Panel"><p>Contenido</p></AppShell></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Salir" })).toBeEnabled();
    expect(screen.getByText("Panel autorizado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administrador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Guardia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inquilino" })).not.toBeInTheDocument();
  });
});
