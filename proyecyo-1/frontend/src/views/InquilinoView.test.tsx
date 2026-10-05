import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { InquilinoView } from "@/views/InquilinoView";
import { getVisitsRequest } from "@/services/visitsService";
import { getTenantPermissionsRequest } from "@/services/sprintStoriesService";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/layout/StatCard", () => ({ StatCard: () => null }));
vi.mock("@/components/visits/QrCodeCard", () => ({ QrCodeCard: () => <div>QR</div> }));

vi.mock("@/services/visitsService", () => ({
  cancelVisitRequest: vi.fn(),
  createVisitRequest: vi.fn(),
  deleteVisitRequest: vi.fn(),
  getFrequentVisitorsRequest: vi.fn().mockResolvedValue([]),
  getVisitsRequest: vi.fn(),
  updateVisitRequest: vi.fn(),
}));

vi.mock("@/services/providersService", () => ({
  createTenantProviderRequest: vi.fn(),
  getTenantProviderHistoryRequest: vi.fn().mockResolvedValue([]),
  getTenantProvidersRequest: vi.fn().mockResolvedValue([]),
  updateTenantProviderRequest: vi.fn(),
}));

vi.mock("@/services/sprintStoriesService", () => ({
  createTenantAuthorizationRequest: vi.fn(),
  getTenantAuthorizationRequestsRequest: vi.fn().mockResolvedValue([]),
  getTenantPermissionsRequest: vi.fn(),
}));

vi.mock("@/services/tenantAccountService", () => ({
  getTenantAccountStatementRequest: vi.fn().mockResolvedValue({
    resumen: { saldo_pendiente: 0, cuotas_vencidas: 0 },
  }),
}));

vi.mock("@/services/notificationsService", () => ({
  getNotificationsRequest: vi.fn().mockResolvedValue([]),
  markNotificationAsReadRequest: vi.fn(),
}));

function renderView() {
  return render(
    <MemoryRouter>
      <InquilinoView section="visitas" />
    </MemoryRouter>,
  );
}

const approvedVisit = {
  id_acceso: 1,
  id_visitante: 1,
  nombre: "Ana Aprobada",
  dpi: "",
  placa: "",
  fecha: "2026-07-20",
  hora_inicio: "10:00",
  hora_fin: "11:00",
  tipo_visita: "VISITA" as const,
  estado_acceso: "AUTORIZADA" as const,
  qr_status: "VALID" as const,
};

const usedVisit = {
  ...approvedVisit,
  id_acceso: 2,
  id_visitante: 2,
  nombre: "Bruno Utilizado",
  estado_acceso: "INGRESO_REGISTRADO" as const,
  qr_status: "USED" as const,
};

describe("Accesos y permisos del inquilino", () => {
  const renderView = (section: "visitas" | "permisos" = "visitas") =>
    render(<MemoryRouter><InquilinoView section={section} /></MemoryRouter>);
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getVisitsRequest).mockResolvedValue([approvedVisit, usedVisit]);
    vi.mocked(getTenantPermissionsRequest).mockResolvedValue([]);
  });

  it("filtra los accesos por estado utilizado", async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("Ana Aprobada")).toBeInTheDocument();
    expect(screen.getByText("Bruno Utilizado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Utilizado" }));

    expect(screen.queryByText("Ana Aprobada")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Utilizado")).toBeInTheDocument();
  });

  it("muestra los permisos activos asignados al inquilino", async () => {
    vi.mocked(getTenantPermissionsRequest).mockResolvedValue([
      {
        id_permiso: 5,
        nombre: "Gestion de visitas",
        descripcion: "Puede crear accesos temporales.",
        restriccion: "Solo dentro del horario permitido.",
        fecha_inicio: "2026-01-01",
        fecha_fin: "2026-12-31",
        estado: "ACTIVO",
      },
    ]);
    renderView("permisos");

    expect(await screen.findByText("Gestion de visitas")).toBeInTheDocument();
    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    expect(screen.getByText(/Solo dentro del horario permitido/)).toBeInTheDocument();
  });

  it("cada sección muestra solo su propia funcionalidad", async () => {
    const { unmount } = renderView("permisos");
    expect(await screen.findByRole("button", { name: /Solicitar autorizacion/ })).toBeInTheDocument();
    expect(screen.queryByText("Gestion de accesos")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion de proveedores")).not.toBeInTheDocument();
    unmount();

    render(<MemoryRouter><InquilinoView section="proveedores" /></MemoryRouter>);
    expect(await screen.findByText("Gestion de proveedores")).toBeInTheDocument();
    expect(screen.queryByText("Gestion de accesos")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solicitar autorizacion/ })).not.toBeInTheDocument();
  });

  it("no muestra alertas fijas ni resumen duplicado del dashboard", async () => {
    renderView();
    expect(await screen.findByText("Ana Aprobada")).toBeInTheDocument();
    expect(screen.queryByText("Solicitud aprobada")).not.toBeInTheDocument();
    expect(screen.queryByText("Alertas del sistema")).not.toBeInTheDocument();
  });
});

describe("Estados de error del inquilino", () => {
  it("muestra el error de carga de permisos en lugar de un falso vacío", async () => {
    vi.mocked(getVisitsRequest).mockResolvedValue([]);
    vi.mocked(getTenantPermissionsRequest).mockRejectedValue(new Error("Permisos no disponibles"));
    render(<MemoryRouter><InquilinoView section="permisos" /></MemoryRouter>);
    expect(await screen.findByText("Permisos no disponibles")).toBeInTheDocument();
    expect(screen.queryByText("No hay permisos asignados.")).not.toBeInTheDocument();
  });
});
