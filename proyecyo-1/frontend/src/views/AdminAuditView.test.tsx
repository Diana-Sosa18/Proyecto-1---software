import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { getAuditLogsRequest } from "@/services/auditService";
import { AdminAuditView } from "./AdminAuditView";

vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/services/auditService", () => ({ getAuditLogsRequest: vi.fn() }));

const record = {
  id_auditoria: 1,
  id_usuario: 2,
  usuario_nombre: "Administrador",
  usuario_correo: "admin@test.com",
  accion: "USER_UPDATED",
  entidad: "USUARIO",
  entidad_id: "9",
  datos_anteriores: { activo: true },
  datos_nuevos: { activo: false },
  direccion_ip: "127.0.0.1",
  creado_en: "2026-09-29 10:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuditLogsRequest).mockResolvedValue([record]);
});

it("muestra los cambios y envia los filtros al backend", async () => {
  render(<AdminAuditView />);
  expect(await screen.findByText("Administrador")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Id de usuario"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Accion"), { target: { value: "USER_UPDATED" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(getAuditLogsRequest).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "2", action: "USER_UPDATED" }));
});
