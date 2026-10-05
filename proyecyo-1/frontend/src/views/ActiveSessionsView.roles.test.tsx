import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { getActiveSessionsRequest } from "@/services/sessionsService";
import { ActiveSessionsView } from "./ActiveSessionsView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/sessionsService", () => ({ getActiveSessionsRequest: vi.fn(), closeActiveSessionRequest: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionsRequest).mockResolvedValue([]);
});

it.each(["residente", "inquilino", "guardia"] as const)("oculta 'Volver al panel' para %s porque tiene sidebar", async (role) => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, email: "u@test.com", role }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  render(<MemoryRouter><ActiveSessionsView /></MemoryRouter>);
  await screen.findByText(/Dispositivos conectados/);
  expect(screen.queryByRole("link", { name: "Volver al panel" })).not.toBeInTheDocument();
});

it("conserva 'Volver al panel' para admin", async () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, email: "a@test.com", role: "admin" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  render(<MemoryRouter><ActiveSessionsView /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: "Volver al panel" })).toHaveAttribute("href", "/admin");
});
