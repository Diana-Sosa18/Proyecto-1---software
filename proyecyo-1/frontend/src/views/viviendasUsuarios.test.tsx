import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHouseRequest, getHouseDetailRequest, getHousesRequest } from "@/services/housesService";
import { getUsersRequest, getUserTypesRequest } from "@/services/usersService";
import type { HouseDetail, HouseRecord } from "@/types/houses";
import { AdminHousesView } from "./AdminHousesView";
import { AdminUsersView } from "./AdminUsersView";
import { AdminView } from "./AdminView";

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => <main><h1>{title}</h1>{actions}{children}</main>,
}));
vi.mock("@/services/housesService", () => ({
  getHousesRequest: vi.fn(), getHouseDetailRequest: vi.fn(), createHouseRequest: vi.fn(), updateHouseRequest: vi.fn(), setHouseActiveRequest: vi.fn(),
}));
vi.mock("@/services/usersService", () => ({
  getUsersRequest: vi.fn(), getUserTypesRequest: vi.fn(), createUserRequest: vi.fn(), updateUserRequest: vi.fn(), deleteUserRequest: vi.fn(),
}));
vi.mock("@/services/adminAccessesService", () => ({
  getAdminAccessesRequest: vi.fn().mockResolvedValue([]), getAdminAccessHourlyChartRequest: vi.fn().mockResolvedValue([]),
  getAdminAccessSummaryRequest: vi.fn().mockResolvedValue({ total_dia: 0, aprobados: 0, pendientes: 0, rechazados: 0 }),
}));
vi.mock("@/services/amenitiesService", () => ({ getAdminAmenityStatsRequest: vi.fn().mockResolvedValue({ por_amenidad: [], ranking: [] }) }));

const house = (id: number, extra: Partial<HouseRecord> = {}): HouseRecord => ({
  id_casa: id, numero: String(300 + id), torre: "B", codigo: `B-${300 + id}`, estado: "DISPONIBLE", activo: true, precio: 96000,
  area_terreno: 208, area_construccion: 128, habitaciones: 3, banos: 2.5, niveles: 2, modelo: "Jacaranda",
  mapa_fila: null, mapa_columna: null, creado_en: null, residente: null, cantidad_inquilinos: 0, ...extra,
});
const list = (viviendas: HouseRecord[]) => ({
  resumen: { total: viviendas.length, disponibles: viviendas.filter((h) => h.estado === "DISPONIBLE").length, ocupadas: viviendas.filter((h) => h.estado === "OCUPADA").length, inactivas: 0 },
  viviendas,
});
const occupied = house(2, { estado: "OCUPADA", residente: { id_usuario: 7, nombre: "Ana Pérez" }, cantidad_inquilinos: 1 });
const occupiedDetail: HouseDetail = {
  ...occupied,
  residente: { id_usuario: 7, nombre: "Ana Pérez", correo: "ana@test.com", telefono: "5555-0001" },
  inquilinos: [{ id_usuario: 8, nombre: "Luis Núñez", correo: "luis@test.com", telefono: null, autorizado: true }],
  tiene_historial_financiero: false,
};
const renderAt = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  vi.mocked(getHousesRequest).mockReset().mockResolvedValue(list([house(1), occupied]));
  vi.mocked(getHouseDetailRequest).mockReset().mockResolvedValue(occupiedDetail);
  vi.mocked(createHouseRequest).mockReset();
  vi.mocked(getUsersRequest).mockReset().mockResolvedValue([]);
  vi.mocked(getUserTypesRequest).mockReset().mockResolvedValue([{ id: 1, nombre: "admin" }]);
});

describe("Página Viviendas (/admin/viviendas) con diseño Los Pinos", () => {
  it("carga las viviendas desde la API: resumen y chips con conteos reales", async () => {
    renderAt(<AdminHousesView />);
    expect(screen.getByText("Cargando viviendas…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Viviendas del residencial" })).toBeInTheDocument();
    expect(screen.getByText("1 de 2 viviendas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Disponible\s*1$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Ocupada\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Inactiva\s*0$/ })).toBeInTheDocument();
    expect(screen.getByText(/El mapa 3D no pudo iniciar/)).toBeInTheDocument();
    expect(getHousesRequest).toHaveBeenCalledWith();
  });

  it("seleccionar una vivienda abre el panel con datos reales, residente e inquilinos; Escape lo cierra", async () => {
    renderAt(<AdminHousesView />);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Ir a una vivienda" }), "2");
    const panel = screen.getByRole("complementary", { name: "Detalle de la vivienda", hidden: true });
    expect(panel).toHaveClass("open");
    expect(within(panel).getByRole("heading", { name: "Casa Jacaranda" })).toBeInTheDocument();
    expect(within(panel).getByText("Manzana B, casa 302")).toBeInTheDocument();
    expect(within(panel).getByText("Q96,000")).toBeInTheDocument();
    expect(await within(panel).findByText("Ana Pérez")).toBeInTheDocument();
    expect(within(panel).getByText("ana@test.com")).toBeInTheDocument();
    expect(within(panel).getByText("Luis Núñez")).toBeInTheDocument();
    expect(getHouseDetailRequest).toHaveBeenCalledWith(2);
    await userEvent.keyboard("{Escape}");
    expect(panel).not.toHaveClass("open");
  });

  it("los modelos de la BD generan sus tarjetas y filtran el mapa", async () => {
    renderAt(<AdminHousesView />);
    expect(await screen.findByRole("heading", { name: "Casa Jacaranda", level: 3 })).toBeInTheDocument();
    expect(screen.getByText((_, el) => Boolean(el?.classList.contains("desde") && /Q96,000\s*1 vivienda disponible/.test(el.textContent ?? "")))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver estas viviendas en el mapa" }));
    expect(screen.getByRole("combobox", { name: "Filtrar por modelo" })).toHaveValue("Jacaranda");
  });

  it("agregar vivienda valida, guarda por API y recarga el mapa", async () => {
    vi.mocked(createHouseRequest).mockResolvedValue({ ...occupiedDetail, id_casa: 9, codigo: "C-1", estado: "DISPONIBLE", residente: null, inquilinos: [] });
    renderAt(<AdminHousesView />);
    await screen.findByRole("heading", { name: "Viviendas del residencial" });
    await userEvent.click(screen.getByRole("button", { name: "Agregar vivienda" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Agregar vivienda" }));
    expect(screen.getByText("El número es obligatorio.")).toBeInTheDocument();
    expect(createHouseRequest).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Número / código *"), "1");
    await userEvent.type(screen.getByLabelText("Torre o manzana"), "C");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Agregar vivienda" }));
    await waitFor(() => expect(createHouseRequest).toHaveBeenCalledWith(expect.objectContaining({ numero: "1", torre: "C" })));
    await waitFor(() => expect(getHousesRequest).toHaveBeenCalledTimes(2));
  });

  it("error de carga visible con reintento que recupera", async () => {
    vi.mocked(getHousesRequest).mockRejectedValueOnce(new Error("Servidor no disponible"));
    renderAt(<AdminHousesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor no disponible");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Viviendas del residencial" })).toBeInTheDocument();
  });

  it("sin viviendas muestra el estado vacío", async () => {
    vi.mocked(getHousesRequest).mockResolvedValue(list([]));
    renderAt(<AdminHousesView />);
    expect(await screen.findByText(/No hay viviendas registradas/)).toBeInTheDocument();
  });
});

describe("Usuarios fuera del Dashboard", () => {
  it("/admin/usuarios es una página propia con el CRUD de usuarios", async () => {
    renderAt(<AdminUsersView />);
    expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
    expect(await screen.findByText("No hay usuarios registrados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por rol" })).toBeInTheDocument();
  });

  it("el Dashboard ya no contiene la gestión de usuarios", async () => {
    renderAt(<AdminView />);
    await screen.findByText("Accesos Hoy");
    expect(screen.queryByText("Usuarios del sistema")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear usuario" })).not.toBeInTheDocument();
    expect(getUsersRequest).not.toHaveBeenCalled();
  });
});
