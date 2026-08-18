import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { getNotificationsRequest } from "@/services/notificationsService";
import { ResidenteView } from "./ResidenteView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(), markAllNotificationsAsReadRequest: vi.fn(), markNotificationAsReadRequest: vi.fn(),
}));
vi.mock("@/services/providersService", () => ({ getOwnerProvidersRequest: vi.fn(async () => []), updateOwnerProviderValidationRequest: vi.fn() }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn(async () => ({ resumen: null })) }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn(async () => []) }));

beforeEach(() => vi.clearAllMocks());

it("muestra el recordatorio de reserva persistido", async () => {
  vi.mocked(getNotificationsRequest).mockResolvedValue([{
    id_notificacion: 9, id_usuario: 17, id_acceso: null, tipo: "RECORDATORIO_RESERVA",
    titulo: "Tu reserva comienza pronto", mensaje: "Tu reserva de Piscina comienza a las 18:00.",
    leido: false, creado_en: "2026-08-20 17:00", leido_en: null,
  }]);
  render(<MemoryRouter><ResidenteView /></MemoryRouter>);
  expect(await screen.findByText("Tu reserva comienza pronto")).toBeInTheDocument();
  expect(screen.getByText(/Piscina comienza a las 18:00/)).toBeInTheDocument();
  expect(screen.getByText(/1 notificacion pendiente/)).toBeInTheDocument();
});
