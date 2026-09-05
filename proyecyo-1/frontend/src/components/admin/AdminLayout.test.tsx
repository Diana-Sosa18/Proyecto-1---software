import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

describe("AdminLayout", () => {
  const logout = vi.fn();

  beforeEach(() => {
    logout.mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: "admin@nexus.test", role: "admin" },
      logout,
    } as ReturnType<typeof useAuth>);
  });

  it("mantiene disponible el cierre de sesión y ejecuta logout", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminLayout title="Panel" subtitle="Administración">
          <p>Contenido</p>
        </AdminLayout>
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Cerrar sesi/ });
    expect(button).toBeVisible();
    await user.click(button);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
