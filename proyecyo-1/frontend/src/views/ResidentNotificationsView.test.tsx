import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { NotificationRecord } from "@/types/notifications";

import {
  getNotificationsPageRequest,
  getUnreadNotificationsRequest,
  markNotificationAsReadRequest,
} from "@/services/notificationsService";
import { ResidentNotificationsView } from "./ResidentNotificationsView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsPageRequest: vi.fn(),
  getUnreadNotificationsRequest: vi.fn(),
  markNotificationAsReadRequest: vi.fn(),
  markAllNotificationsAsReadRequest: vi.fn(),
}));
const page = (items: NotificationRecord[]) => ({ items, next_cursor: null });

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
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([unreadNotification]));
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
});

it("muestra el contador y permite marcar una notificacion como leida", async () => {
  vi.mocked(markNotificationAsReadRequest).mockResolvedValue({ ...unreadNotification, leido: true, leido_en: "2026-09-29 09:00:00" });
  vi.mocked(getNotificationsPageRequest).mockResolvedValueOnce(page([unreadNotification])).mockResolvedValue(page([{...unreadNotification,leido:true}]));
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValueOnce({unread:1}).mockResolvedValue({unread:0});
  render(<MemoryRouter><ResidentNotificationsView /></MemoryRouter>);

  expect(await screen.findByText("Mantenimiento programado")).toBeInTheDocument();
  expect(screen.getByLabelText("1 pendientes")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Marcar como leida" }));

  expect(await screen.findByText("Leida")).toBeInTheDocument();
  expect(markNotificationAsReadRequest).toHaveBeenCalledWith(8);
  expect(screen.getByLabelText("0 pendientes")).toBeInTheDocument();
});

it("los filtros se piden al backend y respetan el filtro inicial de /residente/comunicados", async () => {
  const announcement = { ...unreadNotification, id_notificacion: 10, tipo: "COMUNICADO", titulo: "Asamblea general", leido: true };
  vi.mocked(getNotificationsPageRequest).mockImplementation(async ({ filtro } = {}) =>
    page(filtro === "COMUNICADOS" ? [announcement] : filtro === "OTROS" || filtro === "SIN_LEER" ? [unreadNotification] : [unreadNotification, announcement]));
  render(<MemoryRouter><ResidentNotificationsView initialFilter="COMUNICADOS" /></MemoryRouter>);

  expect(await screen.findByText("Asamblea general")).toBeInTheDocument();
  expect(getNotificationsPageRequest).toHaveBeenCalledWith({ filtro: "COMUNICADOS" });
  expect(screen.queryByText("Mantenimiento programado")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Comunicados" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Comunicado")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Otros avisos" }));
  expect(await screen.findByText("Mantenimiento programado")).toBeInTheDocument();
  expect(getNotificationsPageRequest).toHaveBeenLastCalledWith({ filtro: "OTROS" });
  expect(screen.queryByText("Asamblea general")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Todos" }));
  expect(await screen.findByText("Asamblea general")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Volver al panel" })).not.toBeInTheDocument();
});

it("HU32: 'Ver más avisos' trae la siguiente página con el cursor y conserva lo cargado", async () => {
  const older = { ...unreadNotification, id_notificacion: 3, titulo: "Aviso antiguo", creado_en: "2026-08-01 08:00:00" };
  vi.mocked(getNotificationsPageRequest).mockImplementation(async ({ cursor } = {}) =>
    cursor ? page([older]) : { items: [unreadNotification], next_cursor: "2026-09-29 08:00:00|8" });
  render(<MemoryRouter><ResidentNotificationsView /></MemoryRouter>);
  expect(await screen.findByText("Mantenimiento programado")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver más avisos" }));
  expect(await screen.findByText("Aviso antiguo")).toBeInTheDocument();
  expect(getNotificationsPageRequest).toHaveBeenLastCalledWith({ filtro: "TODOS", cursor: "2026-09-29 08:00:00|8" });
  expect(screen.getByText("Mantenimiento programado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver más avisos" })).not.toBeInTheDocument();
  // El contador sigue siendo el total real, no lo cargado en pantalla.
  expect(screen.getByLabelText("1 pendientes")).toBeInTheDocument();
});

it("HU32: muestra la hora del aviso en Guatemala (creado_en está en UTC)", async () => {
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([{ ...unreadNotification, creado_en: "2026-10-05 06:03:10" }]));
  render(<MemoryRouter><ResidentNotificationsView /></MemoryRouter>);
  await screen.findByText("Mantenimiento programado");
  // 06:03 UTC = 00:03 (12:03 a. m.) del 5 de octubre en Guatemala; nunca "6:03".
  const shown = screen.getByText((_, element) => element?.tagName === "P" && /12:03/.test(element.textContent ?? ""));
  expect(shown.textContent).toMatch(/5\/10\/2026/);
  expect(shown.textContent).not.toMatch(/6:03/);
});
