import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserFormModal } from "@/components/admin/UserFormModal";
import { getHousesRequest } from "@/services/housesService";

vi.mock("@/services/housesService", () => ({ getHousesRequest: vi.fn() }));

const userTypes = [
  { id: 1, nombre: "admin" },
  { id: 3, nombre: "residente" },
];

function renderModal(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <UserFormModal
      isOpen
      isSubmitting={false}
      userTypes={userTypes}
      editingUser={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("UserFormModal", () => {
  it("muestra errores al intentar crear un usuario con campos obligatorios vacios", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("El correo es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La contrasena es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("Seleccione un rol.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia datos normalizados cuando el formulario es valido", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.type(screen.getByLabelText("Nombre"), "  Ana Lopez  ");
    await user.type(screen.getByLabelText("Correo"), "  ANA@EJEMPLO.COM  ");
    await user.type(screen.getByLabelText("Contrasena"), "clave123");
    await user.selectOptions(screen.getByLabelText("Tipo de usuario"), "1");
    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(onSubmit).toHaveBeenCalledWith({
      nombre: "Ana Lopez",
      correo: "ana@ejemplo.com",
      password: "clave123",
      telefono: "",
      id_tipo_usuario: "1",
      id_casa: null,
    });
  });

  it("solicita vivienda (selector de mapa) solo cuando se selecciona el rol residente", async () => {
    vi.mocked(getHousesRequest).mockResolvedValue({ resumen: { total: 0, disponibles: 0, ocupadas: 0, inactivas: 0 }, viviendas: [] });
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByText("Seleccionar vivienda")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Tipo de usuario"), "3");
    expect(screen.getByText("Seleccionar vivienda")).toBeInTheDocument();
    expect(screen.queryByLabelText("Numero de casa")).not.toBeInTheDocument();
    expect(getHousesRequest).toHaveBeenCalledWith({ seleccion: "residente", id_usuario: null });
  });
});
