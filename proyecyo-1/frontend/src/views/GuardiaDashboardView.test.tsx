import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGuardNotificationsRequest } from "@/services/notificationsService";
import { getGuardAccessHistoryRequest } from "@/services/sprintStoriesService";
import { GuardiaDashboardView } from "./GuardiaDashboardView";
import { guatemalaToday } from "@/utils/guatemalaTime";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => <main>{actions}{children}</main>,
}));
vi.mock("@/services/notificationsService", () => ({ getGuardNotificationsRequest: vi.fn() }));
vi.mock("@/services/sprintStoriesService", () => ({ getGuardAccessHistoryRequest: vi.fn() }));

function isoDate() {
  return guatemalaToday();
}

const base = { placa: "", casa: "A-1", tipo_visita: "VISITA", hora_programada: "10:00", hora_ingreso: null, hora_salida: null };
const kpi = (label: string) => screen.getByRole("link", { name: new RegExp(`^${label}:`) });
const renderView = () => render(<MemoryRouter><GuardiaDashboardView /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGuardAccessHistoryRequest).mockResolvedValue([
    { ...base, id_acceso: 1, visitante: "Ana Pendiente", estado: "PENDIENTE", hora_programada: "15:00" },
    { ...base, id_acceso: 2, visitante: "Beto Dentro", estado: "INGRESO", hora_ingreso: "09:10" },
    { ...base, id_acceso: 3, visitante: "Carla Salió", estado: "SALIDA", hora_ingreso: "08:00", hora_salida: "09:30" },
    { ...base, id_acceso: 4, visitante: "Dani Cancelado", estado: "CANCELADA" },
  ]);
  vi.mocked(getGuardNotificationsRequest).mockResolvedValue([
    { id_notificacion: 7, id_usuario: 4, id_acceso: 4, tipo: "ACCESO_CANCELADO", titulo: "Acceso cancelado", mensaje: "Dani ya no ingresará.", leido: false, creado_en: "2026-10-04 08:00:00", leido_en: null },
    { id_notificacion: 8, id_usuario: 4, id_acceso: 1, tipo: "ACCESO_CANCELADO", titulo: "Leída", mensaje: "x", leido: true, creado_en: "2026-10-03 08:00:00", leido_en: "2026-10-03 09:00:00" },
  ]);
});

describe("Dashboard de guardia", () => {
  it("calcula los indicadores del día a partir del historial real de garita", async () => {
    renderView();
    await waitFor(() => expect(getGuardAccessHistoryRequest).toHaveBeenCalledWith({ date: isoDate() }));
    await waitFor(() => expect(within(kpi("Accesos de hoy")).getByText("3")).toBeInTheDocument());
    expect(within(kpi("Pendientes de ingreso")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Dentro ahora")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Dentro ahora")).getByText("1 salida registrada")).toBeInTheDocument();
    expect(within(kpi("Alertas sin leer")).getByText("1")).toBeInTheDocument();
  });

  it("muestra próximos ingresos, movimientos recientes y alertas sin leer", async () => {
    renderView();
    const next = await screen.findByRole("region", { name: "Próximos ingresos" });
    expect(await within(next).findByText("Ana Pendiente")).toBeInTheDocument();
    const movements = screen.getByRole("region", { name: "Movimientos recientes" });
    expect(within(movements).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Carla Salió"),
      expect.stringContaining("Beto Dentro"),
    ]);
    const alerts = screen.getByRole("region", { name: "Alertas recientes" });
    expect(within(alerts).getByText("Acceso cancelado")).toBeInTheDocument();
    expect(within(alerts).queryByText("Leída")).not.toBeInTheDocument();
  });

  it("ofrece acceso directo a escanear y solo enlaza rutas de guardia", async () => {
    renderView();
    await screen.findByText("Ana Pendiente");
    expect(screen.getByRole("link", { name: "Escanear QR" })).toHaveAttribute("href", "/guardia/control");
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/guardia/);
    }
  });

  it("muestra error y estados vacíos sin inventar datos", async () => {
    vi.mocked(getGuardAccessHistoryRequest).mockRejectedValue(new Error("Garita sin conexión"));
    vi.mocked(getGuardNotificationsRequest).mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(within(kpi("Accesos de hoy")).getByText("No disponible")).toBeInTheDocument());
    expect(screen.getAllByText("Garita sin conexión")).toHaveLength(2);
    expect(screen.getByText("No hay alertas sin leer.")).toBeInTheDocument();
  });

  it("muestra estados vacíos cuando no hay accesos hoy", async () => {
    vi.mocked(getGuardAccessHistoryRequest).mockResolvedValue([]);
    renderView();
    expect(await screen.findByText("No hay ingresos pendientes para hoy.")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay ingresos ni salidas registrados hoy.")).toBeInTheDocument();
  });
});

it("HU32: rechazados y por aprobar no cuentan como pendientes ni como accesos del día", async () => {
  vi.mocked(getGuardAccessHistoryRequest).mockResolvedValue([
    { ...base, id_acceso: 1, visitante: "Ana Pendiente", estado: "PENDIENTE" },
    { ...base, id_acceso: 2, visitante: "Rita Rechazo", estado: "RECHAZADA" },
    { ...base, id_acceso: 3, visitante: "Pablo Aprobación", estado: "PENDIENTE_APROBACION" },
    { ...base, id_acceso: 4, visitante: "Dani Cancelado", estado: "CANCELADA" },
  ]);
  vi.mocked(getGuardNotificationsRequest).mockResolvedValue([]);
  render(<MemoryRouter><GuardiaDashboardView /></MemoryRouter>);
  await waitFor(() => expect(within(kpi("Pendientes de ingreso")).getByText("1")).toBeInTheDocument());
  expect(within(kpi("Accesos de hoy")).getByText("1")).toBeInTheDocument();
  const next = screen.getByRole("region", { name: "Próximos ingresos" });
  expect(within(next).queryByText("Rita Rechazo")).not.toBeInTheDocument();
  expect(within(next).queryByText("Pablo Aprobación")).not.toBeInTheDocument();
});
