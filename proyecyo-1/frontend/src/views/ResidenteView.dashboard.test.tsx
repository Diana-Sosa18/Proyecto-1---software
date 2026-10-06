import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getResidentAccountStatementRequest } from "@/services/accountService";
import { getAmenitiesReservationsRequest } from "@/services/amenitiesService";
import {
  getNotificationsRequest,
  getUnreadNotificationsRequest,
  markAllNotificationsAsReadRequest,
} from "@/services/notificationsService";
import { getOwnerProvidersRequest } from "@/services/providersService";
import { getVisitsRequest } from "@/services/visitsService";
import { ResidenteView } from "./ResidenteView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 17, email: "residente@nexus.test", role: "residente" } }) }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(), getUnreadNotificationsRequest: vi.fn(), markAllNotificationsAsReadRequest: vi.fn(), markNotificationAsReadRequest: vi.fn(),
}));
vi.mock("@/services/providersService", () => ({ getOwnerProvidersRequest: vi.fn() }));
vi.mock("@/services/accountService", () => ({ getResidentAccountStatementRequest: vi.fn() }));
vi.mock("@/services/amenitiesService", () => ({ getAmenitiesReservationsRequest: vi.fn() }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn() }));

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const summary = {
  total_cuotas: 4, cuotas_pagadas: 2, cuotas_pendientes: 1, cuotas_vencidas: 1,
  saldo_pendiente: 1250.5, total_pagado: 900, proximo_vencimiento: null, actualizado_en: "2026-10-01 10:00:00",
};

function kpi(label: string) {
  return screen.getByRole("link", { name: new RegExp(`^${label}:`) });
}

function renderView() {
  return render(<MemoryRouter><ResidenteView /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getResidentAccountStatementRequest).mockResolvedValue({ resumen: summary, cuotas: [] });
  vi.mocked(getVisitsRequest).mockResolvedValue([
    { id_acceso: 1, id_visitante: 1, nombre: "Ana López", dpi: "1", placa: "P123ABC", fecha: isoDate(), hora_inicio: "09:00", hora_fin: "10:00", tipo_visita: "VISITA", estado_acceso: "AUTORIZADA" },
    { id_acceso: 2, id_visitante: 2, nombre: "Luis Pérez", dpi: "2", placa: "", fecha: isoDate(2), hora_inicio: "11:00", hora_fin: "12:00", tipo_visita: "VISITA", estado_acceso: "AUTORIZADA" },
    { id_acceso: 3, id_visitante: 3, nombre: "Carla Ruiz", dpi: "3", placa: "", fecha: isoDate(-3), hora_inicio: "11:00", hora_fin: "12:00", tipo_visita: "VISITA", estado_acceso: "SALIDA_REGISTRADA" },
    { id_acceso: 4, id_visitante: 4, nombre: "Cancelado", dpi: "4", placa: "", fecha: isoDate(1), hora_inicio: "11:00", hora_fin: "12:00", tipo_visita: "VISITA", estado_acceso: "CANCELADA" },
  ]);
  vi.mocked(getAmenitiesReservationsRequest).mockResolvedValue([
    { reservation_key: "r1", id_usuario: 17, id_amenidad: 1, amenidad_nombre: "Piscina", fecha: isoDate(1), hora_inicio: "10:00", hora_fin: "11:00", estado: "CONFIRMADA", estado_actual: "CONFIRMADA" },
    { reservation_key: "r2", id_usuario: 17, id_amenidad: 2, amenidad_nombre: "Salón", fecha: isoDate(2), hora_inicio: "10:00", hora_fin: "11:00", estado: "CANCELADA", estado_actual: "CANCELADA" },
  ]);
  vi.mocked(getNotificationsRequest).mockResolvedValue([
    { id_notificacion: 1, id_usuario: 17, id_acceso: null, tipo: "COMUNICADO", titulo: "Corte de agua", mensaje: "Mañana de 8 a 10.", leido: false, creado_en: "2026-10-01 08:00:00", leido_en: null },
    { id_notificacion: 2, id_usuario: 17, id_acceso: null, tipo: "LLEGADA_VISITA", titulo: "Visita ingresó", mensaje: "Ana ingresó.", leido: true, creado_en: "2026-09-30 08:00:00", leido_en: "2026-09-30 09:00:00" },
  ]);
  vi.mocked(getOwnerProvidersRequest).mockResolvedValue([]);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
});

describe("Dashboard del residente", () => {
  it("muestra indicadores calculados con datos reales de las APIs", async () => {
    renderView();
    await waitFor(() => expect(within(kpi("Saldo pendiente")).getByText(/1,250\.50/)).toBeInTheDocument());
    expect(within(kpi("Saldo pendiente")).getByText("1 cuota vencida")).toBeInTheDocument();
    expect(within(kpi("Visitas activas")).getByText("2")).toBeInTheDocument();
    expect(within(kpi("Visitas activas")).getByText("1 para hoy")).toBeInTheDocument();
    expect(within(kpi("Reservas activas")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Avisos no leídos")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Avisos no leídos")).getByText("Pendientes de lectura")).toBeInTheDocument();
    expect(getAmenitiesReservationsRequest).toHaveBeenCalledWith(expect.objectContaining({ id_usuario: 17, from: isoDate(), to: isoDate(30) }));
  });

  it("cada indicador navega a su módulo", async () => {
    renderView();
    expect(kpi("Saldo pendiente")).toHaveAttribute("href", "/residente/pagos");
    expect(kpi("Visitas activas")).toHaveAttribute("href", "/residente/visitas");
    expect(kpi("Reservas activas")).toHaveAttribute("href", "/residente/amenidades");
    expect(kpi("Avisos no leídos")).toHaveAttribute("href", "/residente/notificaciones");
    await screen.findByText("Corte de agua");
  });

  it("es un resumen: no incluye módulos completos, placeholders ni datos fijos", async () => {
    renderView();
    await screen.findByText("Corte de agua");
    expect(screen.queryByText(/Modulo listo para conectar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Salon y cancha activos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Validacion de proveedores/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aprobar/ })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/residente/);
    }
  });

  it("lista visitas recientes, próximas reservas y estado de cuotas", async () => {
    renderView();
    const visits = await screen.findByRole("region", { name: "Visitas recientes" });
    expect(await within(visits).findByText("Ana López")).toBeInTheDocument();
    expect(within(visits).getByText(/Placa P123ABC/)).toBeInTheDocument();
    expect(within(visits).getByText("Salida registrada")).toBeInTheDocument();
    const reservations = screen.getByRole("region", { name: "Próximas reservas" });
    expect(within(reservations).getByText("Piscina")).toBeInTheDocument();
    expect(within(reservations).queryByText("Salón")).not.toBeInTheDocument();
    const quotas = screen.getByRole("region", { name: "Estado de cuotas" });
    expect(within(quotas).getByText("2 de 4 cuotas pagadas")).toBeInTheDocument();
  });

  it("muestra estados de error sin inventar valores", async () => {
    vi.mocked(getResidentAccountStatementRequest).mockRejectedValue(new Error("Servicio financiero no disponible"));
    vi.mocked(getVisitsRequest).mockRejectedValue(new Error("Error de visitas"));
    renderView();
    await waitFor(() => expect(within(kpi("Saldo pendiente")).getByText("No disponible")).toBeInTheDocument());
    expect(within(kpi("Saldo pendiente")).queryByText(/Q/)).not.toBeInTheDocument();
    expect(within(kpi("Visitas activas")).getByText("No disponible")).toBeInTheDocument();
    expect(screen.getByText("Servicio financiero no disponible")).toBeInTheDocument();
    expect(screen.getByText("Error de visitas")).toBeInTheDocument();
  });

  it("muestra estados vacíos", async () => {
    vi.mocked(getVisitsRequest).mockResolvedValue([]);
    vi.mocked(getAmenitiesReservationsRequest).mockResolvedValue([]);
    vi.mocked(getNotificationsRequest).mockResolvedValue([]);
    renderView();
    expect(await screen.findByText("Aún no ha autorizado visitas.")).toBeInTheDocument();
    expect(screen.getByText("No tiene reservas activas en los próximos 30 días.")).toBeInTheDocument();
    expect(screen.getByText("No tiene notificaciones.")).toBeInTheDocument();
  });

  it("muestra estado de carga mientras llegan los datos", () => {
    vi.mocked(getResidentAccountStatementRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getVisitsRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getAmenitiesReservationsRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getNotificationsRequest).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getAllByLabelText("Cargando")).toHaveLength(4);
  });

  it("enlaza a proveedores cuando hay validaciones pendientes", async () => {
    vi.mocked(getOwnerProvidersRequest).mockResolvedValue([{ id_servicio: 1, estado: "PENDIENTE" }] as never);
    renderView();
    expect(await screen.findByText("1 proveedor pendiente de validación")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar proveedores" })).toHaveAttribute("href", "/residente/proveedores");
  });

  it("marca todos los avisos como leídos", async () => {
    const user = userEvent.setup();
    vi.mocked(markAllNotificationsAsReadRequest).mockImplementation(async () => {
      vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 0 });
      return { unread: 0 };
    });
    renderView();
    await screen.findByText("Corte de agua");
    await user.click(screen.getByRole("button", { name: /Marcar todas/ }));
    expect(markAllNotificationsAsReadRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("No tiene notificaciones pendientes.")).toBeInTheDocument();
    expect(within(kpi("Avisos no leídos")).getByText("0")).toBeInTheDocument();
    expect(within(kpi("Avisos no leídos")).getByText("Todo al día")).toBeInTheDocument();
  });
});

it("HU32: los paneles pueden encogerse (min-w-0) para que nombres largos no desborden en móvil", async () => {
  render(<MemoryRouter><ResidenteView /></MemoryRouter>);
  const panel = await screen.findByRole("region", { name: "Visitas recientes" });
  expect(panel.className).toContain("min-w-0");
});
