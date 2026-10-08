import type { HouseRecord } from "@/types/houses";

// Convierte las viviendas de la BD en posiciones del mapa 3D (unidades del mundo;
// 1 unidad ~ 2 m, igual que la referencia "Residencial Los Pinos"). Es una funcion
// pura: no hay manzanas, lotes ni coordenadas fijas en el codigo.
// - Cada torre/manzana es un bloque; cada vivienda usa su mapa_fila/mapa_columna.
// - Viviendas sin posicion guardada se dibujan en el primer hueco libre de su
//   bloque (autoPosicion = true); no se guarda nada.
// - Las filas pares miran a la calle norte y las impares a la calle sur.
export const LOT_WIDTH = 6.5;
export const LOT_DEPTH = 8;
const ROW_GAP = 0.5;
const STREET = 5;
const BLOCKS_PER_ROW = 2;
const DEFAULT_COLUMNS = 6;

export interface MapLot {
  house: HouseRecord;
  x: number;
  z: number;
  facesNorth: boolean;
  autoPosicion: boolean;
  fila: number;
  columna: number;
}

export interface MapBlock {
  key: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface HouseMapLayout {
  lots: MapLot[];
  blocks: MapBlock[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  streetsZ: number[];
}

const rowOffset = (row: number) => row * (LOT_DEPTH + ROW_GAP) + Math.floor(row / 2) * STREET * 0.6;

export function buildHouseMapLayout(houses: HouseRecord[]): HouseMapLayout {
  const groups = new Map<string, HouseRecord[]>();
  houses.forEach((house) => {
    const key = (house.torre ?? "").trim();
    groups.set(key, [...(groups.get(key) ?? []), house]);
  });
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "es", { numeric: true })));

  type Placed = { house: HouseRecord; fila: number; columna: number; auto: boolean };
  const rawBlocks = keys.map((key) => {
    const list = [...(groups.get(key) ?? [])].sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }) || a.id_casa - b.id_casa);
    const fixed = list.filter((h) => h.mapa_fila && h.mapa_columna);
    const columns = Math.max(...fixed.map((h) => h.mapa_columna as number), Math.min(DEFAULT_COLUMNS, Math.max(list.length, 1)));
    const taken = new Set(fixed.map((h) => `${h.mapa_fila}:${h.mapa_columna}`));
    const placed: Placed[] = fixed.map((house) => ({ house, fila: house.mapa_fila as number, columna: house.mapa_columna as number, auto: false }));
    let slot = 0;
    list.filter((h) => !(h.mapa_fila && h.mapa_columna)).forEach((house) => {
      let fila = 0, columna = 0;
      do { fila = Math.floor(slot / columns) + 1; columna = (slot % columns) + 1; slot++; } while (taken.has(`${fila}:${columna}`));
      taken.add(`${fila}:${columna}`);
      placed.push({ house, fila, columna, auto: true });
    });
    const rows = Math.max(1, ...placed.map((p) => p.fila));
    return { key, columns, rows, placed, width: columns * LOT_WIDTH, depth: rowOffset(rows - 1) + LOT_DEPTH };
  });

  // Bloques en filas de BLOCKS_PER_ROW, separados por calles.
  const blocks: MapBlock[] = [];
  const lots: MapLot[] = [];
  const streetsZ: number[] = [];
  let z = 0;
  for (let i = 0; i < rawBlocks.length; i += BLOCKS_PER_ROW) {
    const row = rawBlocks.slice(i, i + BLOCKS_PER_ROW);
    const rowDepth = Math.max(...row.map((b) => b.depth));
    streetsZ.push(z - STREET / 2);
    let x = 0;
    row.forEach((block) => {
      blocks.push({ key: block.key, label: block.key || "Sin manzana", x, z, width: block.width, depth: block.depth });
      block.placed.forEach(({ house, fila, columna, auto }) => {
        lots.push({
          house, fila, columna, autoPosicion: auto,
          x: x + (columna - 0.5) * LOT_WIDTH,
          z: z + rowOffset(fila - 1) + LOT_DEPTH / 2,
          facesNorth: (fila - 1) % 2 === 0,
        });
      });
      x += block.width + STREET;
    });
    z += rowDepth + STREET;
  }
  if (rawBlocks.length) streetsZ.push(z - STREET / 2);

  // Centrar el residencial en el origen.
  const width = Math.max(0, ...blocks.map((b) => b.x + b.width));
  const depth = Math.max(0, z - STREET);
  const dx = width / 2, dz = depth / 2;
  blocks.forEach((b) => { b.x -= dx; b.z -= dz; });
  lots.forEach((l) => { l.x -= dx; l.z -= dz; });
  return {
    lots,
    blocks,
    bounds: { minX: -dx, maxX: width - dx, minZ: -dz, maxZ: depth - dz },
    streetsZ: streetsZ.map((s) => s - dz),
  };
}
