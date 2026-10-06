import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { getAmenitiesReservationsRequest } from "@/services/amenitiesService";
import { getVisitsRequest } from "@/services/visitsService";
import { ResidenteUnifiedView } from "./ResidenteUnifiedView";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/residente/TenantRequestsPanel", () => ({ TenantRequestsPanel: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3, role: "residente" } }) }));
vi.mock("@/services/visitsService", () => ({ getVisitsRequest: vi.fn() }));
vi.mock("@/services/amenitiesService", () => ({ getAmenitiesReservationsRequest: vi.fn() }));

const visit = (id: number, nombre: string, estado_acceso: string) => ({
  id_acceso: id, id_visitante: id, nombre, dpi: "", placa: "", fecha: "2026-10-05", hora_inicio: "08:00", hora_fin: "09:00",
  tipo_visita: "VISITA", estado_acceso, casa: "B-302",
});

beforeEach(() => {
  vi.mocked(getAmenitiesReservationsRequest).mockResolvedValue([]);
  vi.mocked(getVisitsRequest).mockResolvedValue([
    visit(1, "Ana Autorizada", "AUTORIZADA"), visit(2, "Rita Rechazada", "RECHAZADA"),
    visit(3, "Pablo Por aprobar", "PENDIENTE_APROBACION"), visit(4, "Sara Salida", "SALIDA_REGISTRADA"),
  ] as never);
});

it("HU32: solo AUTORIZADA se muestra como Activo; rechazados y por aprobar con su estado real", async () => {
  render(<MemoryRouter><ResidenteUnifiedView /></MemoryRouter>);
  const card = async (name: string) => (await screen.findByText(name)).closest("article") as HTMLElement;
  expect(await card("Ana Autorizada")).toHaveTextContent("Activo");
  expect(await card("Rita Rechazada")).toHaveTextContent("Rechazado");
  expect(await card("Pablo Por aprobar")).toHaveTextContent("Por aprobar");
  expect(await card("Sara Salida")).toHaveTextContent("Utilizado");
});
