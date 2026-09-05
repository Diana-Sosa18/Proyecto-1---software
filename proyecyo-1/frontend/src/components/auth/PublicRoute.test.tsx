import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicRoute } from "@/components/auth/PublicRoute";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderLoginRoute() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<p>Formulario de inicio de sesión</p>} />
        </Route>
        <Route path="/admin" element={<p>Panel administrativo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it("permite abrir el login aunque exista una sesión para cambiar de usuario", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: "admin@nexus.test", role: "admin" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderLoginRoute();

    expect(screen.getByText("Formulario de inicio de sesión")).toBeInTheDocument();
    expect(screen.queryByText("Panel administrativo")).not.toBeInTheDocument();
  });

  it("mantiene la pantalla de preparación mientras carga la sesión", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    renderLoginRoute();

    expect(screen.getByText("Preparando plataforma...")).toBeInTheDocument();
  });
});
