import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNotificationsRequest, getUnreadNotificationsRequest } from "@/services/notificationsService";
import { getTenantProvidersRequest } from "@/services/providersService";
import { getTenantAuthorizationRequestsRequest } from "@/services/sprintStoriesService";
import { getTenantAccountStatementRequest } from "@/services/tenantAccountService";
import { getVisitsRequest } from "@/services/visitsService";
import { InquilinoDashboardView } from "./InquilinoDashboardView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn(), getUnreadNotificationsRequest: vi.fn(), markAllNotificationsAsReadRequest: vi.fn(), markNotificationAsReadRequest: vi.fn(),
}));
vi.mock("@/services/providersService", () => ({ getTenantProvidersRequest: vi.fn() }));
vi.mock("@/services/sprintStoriesService", () => ({ getTenantAuthorizationRequestsRequest: vi.fn() }));
vi.mock("@/services/tenantAccountService", () => ({ getTenantAccountStatementRequest: vi.fn() }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn() }));

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const summary = {
  total_cuotas: 3, cuotas_pagadas: 1, cuotas_pendientes: 1, cuotas_vencidas: 1, saldo_pendiente: 2200,
  alquiler_pendiente: 2200, cuotas_adicionales_pendientes: 0, total_pagado: 500, proximo_vencimiento: null,
  actualizado_en: "2026-10-01 10:00:00",
};

const kpi = (label: string) => screen.getByRole("link", { name: new RegExp(`^${label}:`) });
const renderView = () => render(<MemoryRouter><InquilinoDashboardView /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTenantAccountStatementRequest).mockResolvedValue({ resumen: summary } as never);
  vi.mocked(getVisitsRequest).mockResolvedValue([
    { id_acceso: 1, id_visitante: 1, nombre: "Ana López", dpi: "", placa: "", fecha: isoDate(), hora_inicio: "09:00", hora_fin: "10:00", tipo_visita: "VISITA", estado_acceso: "AUTORIZADA" },
    { id_acceso: 2, id_visitante: 2, nombre: "Luis Pérez", dpi: "", placa: "", fecha: isoDate(-2), hora_inicio: "09:00", hora_fin: "10:00", tipo_visita: "VISITA", estado_acceso: "SALIDA_REGISTRADA" },
  ]);
  vi.mocked(getTenantProvidersRequest).mockResolvedValue([
    { id_servicio: 1, nombre: "Gas", activo: true, estado: "VALIDADO" },
    { id_servicio: 2, nombre: "Limpieza", activo: true, estado: "PENDIENTE" },
    { id_servicio: 3, nombre: "Jardín", activo: false, estado: "VALIDADO" },
  ] as never);
  vi.mocked(getTenantAuthorizationRequestsRequest).mockResolvedValue([
    { id_solicitud: 4, accion: "Mudanza fuera de horario", motivo: "Traslado", estado: "PENDIENTE", respuesta: null, creado_en: "2026-10-01 08:00:00", actualizado_en: "2026-10-01 08:00:00" },
  ]);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({ unread: 1 });
  vi.mocked(getNotificationsRequest).mockResolvedValue([
    { id_notificacion: 1, id_usuario: 9, id_acceso: null, tipo: "COMUNICADO", titulo: "Corte de agua", mensaje: "Mañana.", leido: false, creado_en: "2026-10-01 08:00:00", leido_en: null },
  ]);
});

describe("Dashboard del inquilino", () => {
  it("muestra KPIs calculados con datos reales del inquilino", async () => {
    renderView();
    await waitFor(() => expect(within(kpi("Saldo pendiente")).getByText(/2,200\.00/)).toBeInTheDocument());
    expect(within(kpi("Saldo pendiente")).getByText("1 cuota vencida")).toBeInTheDocument();
    expect(within(kpi("Visitas activas")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Proveedores activos")).getByText("2")).toBeInTheDocument();
    expect(within(kpi("Proveedores activos")).getByText("1 pendiente de validación")).toBeInTheDocument();
    expect(within(kpi("Avisos no leídos")).getByText("1")).toBeInTheDocument();
  });

  it("enlaza cada indicador a una ruta del inquilino", async () => {
    renderView();
    await screen.findByText("Corte de agua");
    expect(kpi("Saldo pendiente")).toHaveAttribute("href", "/inquilino/estado-cuenta");
    expect(kpi("Visitas activas")).toHaveAttribute("href", "/inquilino/visitas");
    expect(kpi("Proveedores activos")).toHaveAttribute("href", "/inquilino/proveedores");
    expect(kpi("Avisos no leídos")).toHaveAttribute("href", "/inquilino/notificaciones");
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/inquilino/);
    }
  });

  it("muestra solicitudes reales y no inventa alertas de permisos aprobados", async () => {
    renderView();
    const panel = await screen.findByRole("region", { name: "Solicitudes de autorización" });
    expect(await within(panel).findByText("Mudanza fuera de horario")).toBeInTheDocument();
    expect(within(panel).getByText("Pendiente")).toBeInTheDocument();
    expect(screen.queryByText("Solicitud aprobada")).not.toBeInTheDocument();
    expect(screen.queryByText(/Modulo listo/i)).not.toBeInTheDocument();
  });

  it("muestra errores sin valores inventados y estados vacíos", async () => {
    vi.mocked(getTenantAccountStatementRequest).mockRejectedValue(new Error("Servicio financiero caído"));
    vi.mocked(getTenantAuthorizationRequestsRequest).mockResolvedValue([]);
    vi.mocked(getVisitsRequest).mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(within(kpi("Saldo pendiente")).getByText("No disponible")).toBeInTheDocument());
    expect(screen.getByText("Servicio financiero caído")).toBeInTheDocument();
    expect(await screen.findByText("No ha enviado solicitudes de autorización.")).toBeInTheDocument();
    expect(screen.getByText("Aún no ha autorizado visitas.")).toBeInTheDocument();
  });

  it("muestra estado de carga", () => {
    vi.mocked(getTenantAccountStatementRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getVisitsRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getTenantProvidersRequest).mockReturnValue(new Promise(() => {}));
    vi.mocked(getNotificationsRequest).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getAllByLabelText("Cargando")).toHaveLength(4);
  });
});
