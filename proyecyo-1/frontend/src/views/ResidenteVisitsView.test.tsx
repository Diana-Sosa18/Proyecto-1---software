import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ResidenteVisitsView } from "@/views/ResidenteVisitsView";
import {
  createVisitRequest,
  getFrequentVisitorsRequest,
  getVisitsRequest,
} from "@/services/visitsService";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/visits/QrCodeCard", () => ({
  QrCodeCard: () => <div>Codigo QR</div>,
}));

vi.mock("@/services/visitsService", () => ({
  createVisitRequest: vi.fn(),
  deleteFrequentVisitorRequest: vi.fn(),
  deleteVisitRequest: vi.fn(),
  getFrequentVisitorsRequest: vi.fn(),
  getVisitsRequest: vi.fn(),
}));

describe("Formulario real de visitas del residente", () => {
  beforeEach(() => {
    vi.mocked(getVisitsRequest).mockResolvedValue([]);
    vi.mocked(getFrequentVisitorsRequest).mockResolvedValue([]);
  });

  it("valida que el nombre del visitante sea obligatorio", async () => {
    const user = userEvent.setup();
    render(<ResidenteVisitsView />, { wrapper: MemoryRouter });

    await screen.findByText("No hay visitas registradas para esta residencia.");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(screen.getByText("El nombre del visitante es obligatorio.")).toBeInTheDocument();
    expect(createVisitRequest).not.toHaveBeenCalled();
  });

  it("registra correctamente una visita al completar los tres pasos", async () => {
    const user = userEvent.setup();
    const createdVisit = {
      id_acceso: 81,
      id_visitante: 22,
      nombre: "Laura Perez",
      dpi: "",
      placa: "",
      fecha: "2026-07-20",
      hora_inicio: "10:00",
      hora_fin: "12:00",
      tipo_visita: "VISITA" as const,
      estado_acceso: "AUTORIZADA" as const,
      qr_status: "VALID" as const,
      token_qr: "qr-laura",
    };
    vi.mocked(createVisitRequest).mockResolvedValue(createdVisit);
    render(<ResidenteVisitsView />, { wrapper: MemoryRouter });

    await screen.findByText("No hay visitas registradas para esta residencia.");
    await user.type(screen.getByLabelText("Nombre Completo *"), "Laura Perez");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.clear(screen.getByLabelText("Hora de inicio *"));
    await user.type(screen.getByLabelText("Hora de inicio *"), "10:00");
    await user.clear(screen.getByLabelText("Hora de fin *"));
    await user.type(screen.getByLabelText("Hora de fin *"), "12:00");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: "Autorizar Visita" }));

    expect(await screen.findByText("Visita autorizada correctamente.")).toBeInTheDocument();
    expect(createVisitRequest).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Laura Perez", tipo_visita: "VISITA", foto: null }),
    );
    expect(screen.getByText("Laura Perez")).toBeInTheDocument();
  });
});
