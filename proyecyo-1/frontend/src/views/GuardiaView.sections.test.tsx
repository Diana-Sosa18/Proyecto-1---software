import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGuardNotificationsRequest,
  getNotificationsRequest,
  markAllGuardNotificationsAsReadRequest,
} from "@/services/notificationsService";
import { getGuardAccessHistoryRequest } from "@/services/sprintStoriesService";
import {
  getGuardVisitsRequest,
  registerQrExitRequest,
  validateQrRequest,
} from "@/services/visitsService";
import type { VisitRecord } from "@/types/visits";
import { GuardiaView, type GuardiaSection } from "./GuardiaView";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/services/visitsService", () => ({
  getGuardVisitsRequest: vi.fn(), registerQrEntryRequest: vi.fn(), registerQrExitRequest: vi.fn(), validateQrRequest: vi.fn(),
}));
vi.mock("@/services/notificationsService", () => ({
  getGuardNotificationsRequest: vi.fn(), getNotificationsRequest: vi.fn(),
  markAllGuardNotificationsAsReadRequest: vi.fn(), markGuardNotificationAsReadRequest: vi.fn(),
}));
vi.mock("@/services/sprintStoriesService", () => ({ getGuardAccessHistoryRequest: vi.fn() }));

const insideVisit: VisitRecord = {
  id_acceso: 11, id_visitante: 1, nombre: "Ana Dentro", dpi: "", placa: "P1", fecha: "2026-10-04", hora_inicio: "09:00",
  hora_fin: "11:00", tipo_visita: "VISITA", estado_acceso: "INGRESO_REGISTRADO", qr_status: "USED", token_qr: "tok-11", casa: "A-1",
};

const renderSection = (section: GuardiaSection) => render(<MemoryRouter><GuardiaView section={section} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGuardVisitsRequest).mockResolvedValue([insideVisit]);
  vi.mocked(getGuardNotificationsRequest).mockResolvedValue([]);
  vi.mocked(getNotificationsRequest).mockResolvedValue([]);
  vi.mocked(getGuardAccessHistoryRequest).mockResolvedValue([]);
});

describe("GuardiaView por secciones", () => {
  it("Control de acceso valida un QR manual con la API existente", async () => {
    vi.mocked(validateQrRequest).mockResolvedValue({ ...insideVisit, nombre: "Beto Valido" });
    renderSection("control");
    expect(screen.getByRole("heading", { level: 1, name: "Control de acceso" })).toBeInTheDocument();
    expect(screen.queryByText("Control de ingresos")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Código QR manual"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Validar QR" }));
    await waitFor(() => expect(validateQrRequest).toHaveBeenCalledWith({ qrToken: "abc" }));
    expect(await screen.findByText("Visita autorizada e ingreso registrado.")).toBeInTheDocument();
  });

  it("Visitas recientes lista visitas y registra salidas", async () => {
    vi.mocked(registerQrExitRequest).mockResolvedValue({ ...insideVisit, estado_acceso: "SALIDA_REGISTRADA", qr_status: "EXIT_REGISTERED", hora_salida: "10:30" });
    renderSection("visitas");
    expect(await screen.findByText("Ana Dentro")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código QR manual")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar salida" }));
    await waitFor(() => expect(registerQrExitRequest).toHaveBeenCalledWith({ qrToken: "tok-11" }));
  });

  it("Visitas recientes muestra estado vacío", async () => {
    vi.mocked(getGuardVisitsRequest).mockResolvedValue([]);
    renderSection("visitas");
    expect(await screen.findByText("No hay visitas registradas para el turno.")).toBeInTheDocument();
  });

  it("Historial consulta con filtros etiquetados", async () => {
    renderSection("historial");
    await waitFor(() => expect(getGuardAccessHistoryRequest).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "SALIDA" } });
    await waitFor(() => expect(getGuardAccessHistoryRequest).toHaveBeenLastCalledWith(expect.objectContaining({ status: "SALIDA" })));
    expect(screen.getByLabelText("Fecha del historial")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar visitante o casa")).toBeInTheDocument();
  });

  it("Alertas muestra cancelaciones, permite marcarlas y tiene estado vacío", async () => {
    vi.mocked(getGuardNotificationsRequest).mockResolvedValue([
      { id_notificacion: 3, id_usuario: 4, id_acceso: 11, tipo: "ACCESO_CANCELADO", titulo: "Acceso cancelado", mensaje: "No autorizar.", leido: false, creado_en: "2026-10-04 08:00:00", leido_en: null },
    ]);
    vi.mocked(markAllGuardNotificationsAsReadRequest).mockResolvedValue({ unread: 0 });
    renderSection("alertas");
    expect(await screen.findByText("Acceso cancelado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar todas/ }));
    expect(await screen.findByText(/No hay alertas pendientes/)).toBeInTheDocument();
    expect(markAllGuardNotificationsAsReadRequest).toHaveBeenCalledTimes(1);
  });
});
