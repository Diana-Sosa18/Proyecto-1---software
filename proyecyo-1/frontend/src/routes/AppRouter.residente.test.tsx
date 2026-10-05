import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { AppRouter } from "@/routes/AppRouter";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => ({ [name]: () => <p>vista:{name}</p> }),
}));
vi.mock("@/views/ResidenteView", stub("ResidenteView"));
vi.mock("@/views/ResidenteAccountView", stub("ResidenteAccountView"));
vi.mock("@/views/ResidentePaymentReturnView", stub("ResidentePaymentReturnView"));
vi.mock("@/views/ResidentePaymentReceiptView", stub("ResidentePaymentReceiptView"));
vi.mock("@/views/ResidenteUnifiedView", stub("ResidenteUnifiedView"));
vi.mock("@/views/ResidenteRegulationsView", stub("ResidenteRegulationsView"));
vi.mock("@/views/ResidenteVisitsView", stub("ResidenteVisitsView"));
vi.mock("@/views/ResidenteAmenitiesView", stub("ResidenteAmenitiesView"));
vi.mock("@/views/ResidenteUnifiedAmenitiesAvailabilityView", stub("ResidenteUnifiedAmenitiesAvailabilityView"));
vi.mock("@/views/ResidentMonthlySummaryView", stub("ResidentMonthlySummaryView"));
vi.mock("@/views/ResidenteFinancialDetailView", stub("ResidenteFinancialDetailView"));
vi.mock("@/views/ResidenteProvidersView", stub("ResidenteProvidersView"));
vi.mock("@/views/ActiveSessionsView", stub("ActiveSessionsView"));
vi.mock("@/views/AdminView", stub("AdminView"));
vi.mock("@/views/AdminProvidersView", stub("AdminProvidersView"));
vi.mock("@/views/ResidentNotificationsView", () => ({
  ResidentNotificationsView: ({ initialFilter }: { initialFilter?: string }) => <p>vista:ResidentNotificationsView:{initialFilter ?? "TODOS"}</p>,
}));

function renderAt(path: string, role: "residente" | "admin" | "inquilino" = "residente") {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 3, email: `${role}@nexus.test`, role },
    isLoading: false,
  } as unknown as ReturnType<typeof useAuth>);
  window.history.pushState({}, "", path);
  render(<AppRouter />);
}

beforeEach(() => vi.clearAllMocks());

describe("Rutas del residente", () => {
  it.each([
    ["/residente", "ResidenteView"],
    ["/residente/visitas", "ResidenteVisitsView"],
    ["/residente/pagos", "ResidenteAccountView"],
    ["/residente/estado-cuenta", "ResidenteAccountView"],
    ["/residente/pagos/retorno", "ResidentePaymentReturnView"],
    ["/residente/pagos/12/comprobante", "ResidentePaymentReceiptView"],
    ["/residente/detalle-financiero", "ResidenteFinancialDetailView"],
    ["/residente/amenidades", "ResidenteAmenitiesView"],
    ["/residente/amenidades/disponibilidad-general", "ResidenteUnifiedAmenitiesAvailabilityView"],
    ["/residente/unificado", "ResidenteUnifiedView"],
    ["/residente/reglamentos", "ResidenteRegulationsView"],
    ["/residente/resumen-mensual", "ResidentMonthlySummaryView"],
    ["/residente/proveedores", "ResidenteProvidersView"],
    ["/residente/notificaciones", "ResidentNotificationsView:TODOS"],
    ["/residente/comunicados", "ResidentNotificationsView:COMUNICADOS"],
    ["/residente/sesiones", "ActiveSessionsView"],
    ["/cuenta/sesiones", "ActiveSessionsView"],
  ])("%s renderiza %s", (path, view) => {
    renderAt(path);
    expect(screen.getByText(`vista:${view}`)).toBeInTheDocument();
  });

  it("un residente no puede abrir rutas de administración", () => {
    renderAt("/admin/proveedores");
    expect(screen.queryByText("vista:AdminProvidersView")).not.toBeInTheDocument();
    expect(screen.getByText("vista:ResidenteView")).toBeInTheDocument();
  });

  it("otros roles no acceden a las nuevas rutas del residente", () => {
    renderAt("/residente/proveedores", "admin");
    expect(screen.queryByText("vista:ResidenteProvidersView")).not.toBeInTheDocument();
    expect(screen.getByText("vista:AdminView")).toBeInTheDocument();
  });

  it("rutas desconocidas del residente regresan al dashboard", () => {
    renderAt("/residente/incidencias");
    expect(screen.getByText("vista:ResidenteView")).toBeInTheDocument();
  });
});
