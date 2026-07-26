import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingView } from "@/views/LandingView";
import { PrivacyView } from "@/views/PrivacyView";
import * as demoService from "@/services/demoRequestsService";

vi.mock("@/services/demoRequestsService", async () => {
  const actual = await vi.importActual<typeof import("@/services/demoRequestsService")>("@/services/demoRequestsService");
  return { ...actual, createDemoRequest: vi.fn() };
});

describe("Landing comercial", () => {
  beforeEach(() => {
    vi.mocked(demoService.createDemoRequest).mockReset();
    vi.mocked(demoService.createDemoRequest).mockResolvedValue({ id: 1, message: "Solicitud recibida correctamente" });
  });

  it("renderiza la propuesta, funcionalidades y acceso al login", () => {
    render(<LandingView />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: /Administra tu residencial/ })).toBeInTheDocument();
    expect(screen.getByText("Accesos y visitas")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" })[0]).toHaveAttribute("href", "/login");
  });

  it("abre y cierra el menú móvil", async () => {
    const user = userEvent.setup();
    render(<LandingView />, { wrapper: MemoryRouter });
    const button = screen.getByRole("button", { name: "Abrir menú" });
    await user.click(button);
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Beneficios" })[1]);
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("valida un formulario vacío", async () => {
    render(<LandingView />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getAllByRole("button", { name: "Solicitar demostración" }).at(-1)!);
    expect(await screen.findByText("Ingresa tu nombre completo.")).toBeInTheDocument();
    expect(demoService.createDemoRequest).not.toHaveBeenCalled();
  });

  it("envía datos válidos, evita doble envío y muestra confirmación", async () => {
    let resolve!: (value: { id: number; message: string }) => void;
    vi.mocked(demoService.createDemoRequest).mockReturnValue(new Promise((done) => { resolve = done; }));
    const user = userEvent.setup();
    render(<LandingView />, { wrapper: MemoryRouter });
    await user.type(screen.getByLabelText("Nombre completo"), "María López");
    await user.type(screen.getByLabelText("Correo electrónico"), "maria@example.com");
    await user.type(screen.getByLabelText("Teléfono"), "+502 5555 5555");
    await user.type(screen.getByLabelText("Residencial o condominio"), "Las Flores");
    await user.type(screen.getByLabelText("Cantidad aproximada de viviendas"), "120");
    await user.click(screen.getByRole("checkbox"));
    const submit = screen.getAllByRole("button", { name: "Solicitar demostración" }).at(-1)!;
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(demoService.createDemoRequest).toHaveBeenCalledTimes(1);
    resolve({ id: 1, message: "Solicitud recibida correctamente" });
    expect(await screen.findByText(/Gracias por tu interés/)).toBeInTheDocument();
  });

  it("conserva los datos y muestra el error seguro del backend", async () => {
    vi.mocked(demoService.createDemoRequest).mockRejectedValue(new Error("Servicio temporalmente no disponible."));
    const user = userEvent.setup();
    render(<LandingView />, { wrapper: MemoryRouter });
    await user.type(screen.getByLabelText("Nombre completo"), "María López");
    await user.type(screen.getByLabelText("Correo electrónico"), "maria@example.com");
    await user.type(screen.getByLabelText("Teléfono"), "+502 5555 5555");
    await user.type(screen.getByLabelText("Residencial o condominio"), "Las Flores");
    await user.type(screen.getByLabelText("Cantidad aproximada de viviendas"), "120");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getAllByRole("button", { name: "Solicitar demostración" }).at(-1)!);
    expect(await screen.findByText("Servicio temporalmente no disponible.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("María López");
  });

  it("muestra la política pública", () => {
    render(<PrivacyView />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: "Política de privacidad" })).toBeInTheDocument();
    expect(screen.getByText(/revisado por asesoría legal/)).toBeInTheDocument();
  });
});
