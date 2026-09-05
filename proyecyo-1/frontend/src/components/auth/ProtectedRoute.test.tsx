import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderRoutes() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<p>Inicio de sesion</p>} />
        <Route path="/residente" element={<p>Panel residente</p>} />
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<p>Panel administrativo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it("renderiza el contenido cuando el usuario tiene el rol permitido", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 1, email: "admin@nexus.test", role: "admin" }, isLoading: false } as ReturnType<typeof useAuth>);
    renderRoutes();
    expect(screen.getByText("Panel administrativo")).toBeInTheDocument();
  });

  it("redirige al panel propio cuando el rol no esta permitido", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 2, email: "residente@nexus.test", role: "residente" }, isLoading: false } as ReturnType<typeof useAuth>);
    renderRoutes();
    expect(screen.getByText("Panel residente")).toBeInTheDocument();
    expect(screen.queryByText("Panel administrativo")).not.toBeInTheDocument();
  });
});
