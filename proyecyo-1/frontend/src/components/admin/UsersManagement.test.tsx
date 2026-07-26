import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { getUsersRequest, getUserTypesRequest } from "@/services/usersService";

vi.mock("@/services/usersService", () => ({
  createUserRequest: vi.fn(),
  deleteUserRequest: vi.fn(),
  getUserTypesRequest: vi.fn(),
  getUsersRequest: vi.fn(),
  updateUserRequest: vi.fn(),
}));

describe("UsersManagement", () => {
  beforeEach(() => {
    vi.mocked(getUsersRequest).mockResolvedValue([]);
    vi.mocked(getUserTypesRequest).mockResolvedValue([{ id: 1, nombre: "admin" }]);
  });

  it("abre y cierra el modal desde sus botones", async () => {
    const user = userEvent.setup();
    render(<UsersManagement />);

    expect(await screen.findByText("No hay usuarios registrados.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(screen.getByRole("heading", { name: "Crear usuario" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Crear usuario" })).not.toBeInTheDocument();
  });
});
