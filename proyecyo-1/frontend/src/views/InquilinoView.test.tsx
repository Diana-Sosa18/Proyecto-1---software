import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

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
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getVisitsRequest).mockResolvedValue([approvedVisit, usedVisit]);
    vi.mocked(getTenantPermissionsRequest).mockResolvedValue([]);
  });

  it("filtra los accesos por estado utilizado", async () => {
    const user = userEvent.setup();
    render(<InquilinoView />);

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
    render(<InquilinoView />);

    expect(await screen.findByText("Gestion de visitas")).toBeInTheDocument();
    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    expect(screen.getByText(/Solo dentro del horario permitido/)).toBeInTheDocument();
  });
});
