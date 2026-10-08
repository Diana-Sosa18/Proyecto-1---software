import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { HouseRecord } from "@/types/houses";
import { buildHouseMapLayout, LOT_WIDTH } from "@/utils/houseMapLayout";
import { validateHouseForm } from "./HouseFormModal";
import { HouseMap } from "./HouseMap";

// El motor 3D real necesita WebGL (no existe en jsdom): se simula su fallo.
vi.mock("./HouseMap3D", () => ({
  default: ({ onFailure }: { onFailure: (m: string) => void }) => {
    onFailure("No se pudo iniciar WebGL (simulado).");
    return null;
  },
}));

const house = (id: number, extra: Partial<HouseRecord> = {}): HouseRecord => ({
  id_casa: id, numero: String(100 + id), torre: "A", codigo: `A-${100 + id}`, estado: "DISPONIBLE", activo: true,
  precio: 96000, area_terreno: 208, area_construccion: 128, habitaciones: 3, banos: 2.5, niveles: 2, modelo: "Jacaranda",
  mapa_fila: null, mapa_columna: null, creado_en: null, residente: null, cantidad_inquilinos: 0, ...extra,
});

describe("buildHouseMapLayout (posiciones desde la BD)", () => {
  it("usa fila/columna guardadas y coloca las demas en huecos libres sin superponerlas", () => {
    const houses = [house(1, { mapa_fila: 1, mapa_columna: 1 }), house(2, { mapa_fila: 1, mapa_columna: 2 }), house(3), house(4)];
    const { lots } = buildHouseMapLayout(houses);
    const keys = lots.map((l) => `${l.fila}:${l.columna}`);
    expect(new Set(keys).size).toBe(lots.length);
    expect(lots.find((l) => l.house.id_casa === 1)).toMatchObject({ fila: 1, columna: 1, autoPosicion: false });
    expect(lots.filter((l) => l.autoPosicion).map((l) => l.house.id_casa).sort()).toEqual([3, 4]);
    const [a, b] = [lots.find((l) => l.house.id_casa === 1)!, lots.find((l) => l.house.id_casa === 2)!];
    expect(b.x - a.x).toBeCloseTo(LOT_WIDTH);
  });

  it("cada torre es un bloque separado por calle, y las filas alternan su frente", () => {
    const layout = buildHouseMapLayout([
      house(1, { mapa_fila: 1, mapa_columna: 1 }), house(2, { mapa_fila: 2, mapa_columna: 1 }),
      house(3, { torre: "B", codigo: "B-103" }),
    ]);
    expect(layout.blocks.map((b) => b.label)).toEqual(["A", "B"]);
    const [blockA, blockB] = layout.blocks;
    expect(blockB.x).toBeGreaterThan(blockA.x + blockA.width);
    const lotA1 = layout.lots.find((l) => l.house.id_casa === 1)!, lotA2 = layout.lots.find((l) => l.house.id_casa === 2)!;
    expect([lotA1.facesNorth, lotA2.facesNorth]).toEqual([true, false]);
    expect(layout.bounds.minX).toBeCloseTo(-layout.bounds.maxX);
  });

  it("sin viviendas no inventa lotes", () => {
    expect(buildHouseMapLayout([]).lots).toEqual([]);
  });
});

describe("validateHouseForm", () => {
  const base = { numero: "1", torre: "", precio: "", area_terreno: "", area_construccion: "", habitaciones: "", banos: "", niveles: "", modelo: "", mapa_fila: "", mapa_columna: "" };
  it("acepta un formulario minimo y rechaza valores invalidos", () => {
    expect(validateHouseForm(base)).toEqual({});
    expect(validateHouseForm({ ...base, numero: " " }).numero).toBeTruthy();
    expect(validateHouseForm({ ...base, precio: "-5" }).precio).toBeTruthy();
    expect(validateHouseForm({ ...base, precio: "10.999" }).precio).toBeTruthy();
    expect(validateHouseForm({ ...base, banos: "2.3" }).banos).toBeTruthy();
    expect(validateHouseForm({ ...base, niveles: "0" }).niveles).toBeTruthy();
    expect(validateHouseForm({ ...base, mapa_fila: "2" }).mapa_columna).toBeTruthy();
  });
});

describe("HouseMap", () => {
  const houses = [house(1), house(2, { estado: "OCUPADA", residente: { id_usuario: 9, nombre: "Ana" } }), house(3, { activo: false })];
  const summary = { total: 3, disponibles: 2, ocupadas: 1, inactivas: 1 };

  it("sin WebGL muestra el aviso y una lista accesible; la leyenda usa los conteos reales", async () => {
    const onSelect = vi.fn();
    render(<HouseMap houses={houses} summary={summary} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText(/no está disponible en este navegador/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disponible\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocupada\s*1/ })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("list", { name: "Lista de viviendas" })).getByRole("button", { name: /A-101/ }));
    expect(onSelect).toHaveBeenCalledWith(houses[0]);
  });

  it("los filtros ocultan viviendas por estado", async () => {
    render(<HouseMap houses={houses} summary={summary} selectedId={null} onSelect={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Lista de viviendas" });
    expect(within(list).getByText("A-102")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Ocupada\s*\d+$/ }));
    expect(screen.getByRole("button", { name: /^Ocupada\s*\d+$/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(list).queryByText("A-102")).not.toBeInTheDocument();
  });

  it("si el motor 3D falla con WebGL disponible, cae a la lista con un mensaje visible", async () => {
    render(<HouseMap houses={houses} summary={summary} selectedId={null} onSelect={vi.fn()} webglSupported />);
    await waitFor(() => expect(screen.getByText(/No se pudo iniciar WebGL \(simulado\)/)).toBeInTheDocument());
    expect(screen.getByRole("list", { name: "Lista de viviendas" })).toBeInTheDocument();
  });

  it("una vivienda no seleccionable no se elige y explica el motivo", async () => {
    const onSelect = vi.fn();
    render(<HouseMap houses={houses} selectedId={null} onSelect={onSelect}
      selectable={(h) => (h.estado === "DISPONIBLE" && h.activo ? { ok: true } : { ok: false, motivo: "Ocupada por otro residente." })} />);
    await userEvent.click(screen.getByRole("button", { name: /A-102/ }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/A-102 no se puede seleccionar: Ocupada por otro residente/)).toBeInTheDocument();
  });

  it("sin viviendas muestra el estado vacio", () => {
    render(<HouseMap houses={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No hay viviendas registradas.")).toBeInTheDocument();
  });
});
