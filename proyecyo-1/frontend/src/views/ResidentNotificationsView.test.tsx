import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import {
  getNotificationsRequest,
  getUnreadNotificationsRequest,
  markNotificationAsReadRequest,
} from "@/services/notificationsService";
import { ResidentNotificationsView } from "./ResidentNotificationsView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(),
  getUnreadNotificationsRequest: vi.fn(),
  markNotificationAsReadRequest: vi.fn(),
  markAllNotificationsAsReadRequest: vi.fn(),
}));

const unreadNotification = {
  id_notificacion: 8,
  id_usuario: 3,
  id_acceso: null,
  tipo: "AVISO",
  titulo: "Mantenimiento programado",
  mensaje: "El servicio de agua se interrumpira a las 10:00.",
  leido: false,
  creado_en: "2026-09-29 08:00:00",
  leido_en: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNotificationsRequest).mockResolvedValue([unreadNotification]);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
});

it("muestra el contador y permite marcar una notificacion como leida", async () => {
  vi.mocked(markNotificationAsReadRequest).mockResolvedValue({ ...unreadNotification, leido: true, leido_en: "2026-09-29 09:00:00" });
  vi.mocked(getNotificationsRequest).mockResolvedValueOnce([unreadNotification]).mockResolvedValue([{...unreadNotification,leido:true}]);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValueOnce({unread:1}).mockResolvedValue({unread:0});
  render(<MemoryRouter><ResidentNotificationsView /></MemoryRouter>);

  expect(await screen.findByText("Mantenimiento programado")).toBeInTheDocument();
  expect(screen.getByLabelText("1 pendientes")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Marcar como leida" }));

  expect(await screen.findByText("Leida")).toBeInTheDocument();
  expect(markNotificationAsReadRequest).toHaveBeenCalledWith(8);
  expect(screen.getByLabelText("0 pendientes")).toBeInTheDocument();
});

it("filtra comunicados y avisos y respeta el filtro inicial de /residente/comunicados", async () => {
  const announcement = { ...unreadNotification, id_notificacion: 10, tipo: "COMUNICADO", titulo: "Asamblea general", leido: true };
  vi.mocked(getNotificationsRequest).mockResolvedValue([unreadNotification, announcement]);
  render(<MemoryRouter><ResidentNotificationsView initialFilter="COMUNICADOS" /></MemoryRouter>);

  expect(await screen.findByText("Asamblea general")).toBeInTheDocument();
  expect(screen.queryByText("Mantenimiento programado")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Comunicados" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Comunicado")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Otros avisos" }));
  expect(screen.getByText("Mantenimiento programado")).toBeInTheDocument();
  expect(screen.queryByText("Asamblea general")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Sin leer" }));
  expect(screen.getByText("Mantenimiento programado")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Todos" }));
  expect(screen.getByText("Asamblea general")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Volver al panel" })).not.toBeInTheDocument();
});
