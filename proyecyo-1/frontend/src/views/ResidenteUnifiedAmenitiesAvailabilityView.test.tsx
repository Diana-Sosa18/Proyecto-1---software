import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { getUnifiedAmenityAvailabilityRequest } from "@/services/amenitiesService";
import { ResidenteUnifiedAmenitiesAvailabilityView } from "./ResidenteUnifiedAmenitiesAvailabilityView";

vi.mock("@/services/amenitiesService", () => ({ getUnifiedAmenityAvailabilityRequest: vi.fn() }));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("compara amenidades y bloquea horarios ocupados", async () => {
  vi.mocked(getUnifiedAmenityAvailabilityRequest).mockResolvedValue({
    fecha: "2026-08-20",
    amenidades: [1, 2].map((id) => ({
      amenidad: { id_amenidad: id, nombre: `Amenidad ${id}`, descripcion: "", hora_apertura: "08:00", hora_cierre: "10:00", intervalo_minutos: 60, activo: true },
      fecha: "2026-08-20",
      reservas: [],
      slots: [{ hora_inicio: "08:00", hora_fin: "09:00", disponible: id === 1, reserva: null }],
    })),
  });

  render(<MemoryRouter><ResidenteUnifiedAmenitiesAvailabilityView /></MemoryRouter>);
  expect(await screen.findByText("Amenidad 1")).toBeInTheDocument();
  expect(screen.getByText("Amenidad 2")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /08:00.*09:00.*Ocupado/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /08:00.*09:00.*Disponible/ }));
  expect(screen.getByRole("button", { name: "Continuar a reservar" })).toBeEnabled();
});

it("actualiza la disponibilidad al cambiar la fecha", async () => {
  vi.mocked(getUnifiedAmenityAvailabilityRequest).mockResolvedValue({ fecha: "2026-08-20", amenidades: [] });
  render(<MemoryRouter><ResidenteUnifiedAmenitiesAvailabilityView /></MemoryRouter>);
  await waitFor(() => expect(getUnifiedAmenityAvailabilityRequest).toHaveBeenCalledTimes(1));

  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-08-21" } });

  await waitFor(() => expect(getUnifiedAmenityAvailabilityRequest).toHaveBeenLastCalledWith("2026-08-21"));
});
