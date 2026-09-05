import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ResidenteRegulationsView } from "@/views/ResidenteRegulationsView";
import { getResidentRegulationsRequest } from "@/services/sprintStoriesService";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/services/sprintStoriesService", () => ({
  getResidentRegulationsRequest: vi.fn(),
}));

const regulations = [
  { id_reglamento: 1, categoria: "Convivencia", titulo: "Ruido", contenido: "Horario de silencio", actualizado_en: "2026-01-10" },
  { id_reglamento: 2, categoria: "Mascotas", titulo: "Areas comunes", contenido: "Uso de correa", actualizado_en: "2026-01-11" },
];

describe("ResidenteRegulationsView", () => {
  it("busca reglamentos enviando el texto ingresado al servicio", async () => {
    vi.mocked(getResidentRegulationsRequest).mockImplementation(async ({ search }) =>
      regulations.filter((item) => item.titulo.toLowerCase().includes(search.toLowerCase())),
    );
    const user = userEvent.setup();
    render(<ResidenteRegulationsView />, { wrapper: MemoryRouter });

    expect((await screen.findAllByText("Ruido")).length).toBeGreaterThan(0);
    await user.type(screen.getByPlaceholderText("Buscar reglamento..."), "Areas");

    await waitFor(() => {
      expect(getResidentRegulationsRequest).toHaveBeenLastCalledWith({ search: "Areas", category: "" });
    });
    expect((await screen.findAllByText("Areas comunes")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Horario de silencio")).not.toBeInTheDocument();
  });
});
