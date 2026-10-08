import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { Box, List, Map as MapIcon } from "lucide-react";

import type { HouseRecord, HouseStatus, HouseSummary } from "@/types/houses";
import { buildHouseMapLayout } from "@/utils/houseMapLayout";
import type { MapView } from "./HouseMap3D";

// Three.js se carga aparte (no entra en el bundle principal).
const HouseMap3D = lazy(() => import("./HouseMap3D"));

export const houseStatusLabels: Record<HouseStatus, string> = { DISPONIBLE: "Disponible", OCUPADA: "Ocupada" };
const statusDot: Record<HouseStatus, string> = { DISPONIBLE: "bg-emerald-500", OCUPADA: "bg-blue-600" };

export function supportsWebGL() {
  if (typeof window === "undefined" || /jsdom/i.test(window.navigator.userAgent)) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export interface HouseMapProps {
  houses: HouseRecord[];
  summary?: HouseSummary | null;
  selectedId: number | null;
  onSelect: (house: HouseRecord) => void;
  // Para el selector de usuarios: las no elegibles se atenuan y no se pueden elegir.
  selectable?: (house: HouseRecord) => { ok: boolean; motivo?: string | null };
  title?: string;
  className?: string;
  // Estados visibles al abrir (p. ej. el selector de residente muestra primero las disponibles).
  initialVisible?: Partial<Record<HouseStatus, boolean>>;
  // Solo para pruebas: forzar la deteccion de WebGL.
  webglSupported?: boolean;
}

export function HouseMap({ houses, summary, selectedId, onSelect, selectable, title = "Mapa de viviendas", className = "", initialVisible, webglSupported }: HouseMapProps) {
  const [visibleStatus, setVisibleStatus] = useState<Record<HouseStatus, boolean>>({ DISPONIBLE: true, OCUPADA: true, ...initialVisible });
  const [webgl] = useState(() => webglSupported ?? supportsWebGL());
  const [failure, setFailure] = useState("");
  const [view, setView] = useState<MapView | "lista">(webgl ? "3d" : "lista");
  const [notice, setNotice] = useState("");
  const can3D = webgl && !failure;
  const mode = can3D ? view : "lista";

  const counts = useMemo(() => summary
    ? { DISPONIBLE: summary.disponibles, OCUPADA: summary.ocupadas }
    : { DISPONIBLE: houses.filter((h) => h.estado === "DISPONIBLE").length, OCUPADA: houses.filter((h) => h.estado === "OCUPADA").length },
  [houses, summary]);
  const layout = useMemo(() => buildHouseMapLayout(houses), [houses]);
  const check = useCallback((house: HouseRecord) => selectable?.(house) ?? { ok: true }, [selectable]);
  const isDimmed = useCallback((house: HouseRecord) => !visibleStatus[house.estado] || !check(house).ok, [visibleStatus, check]);
  const describe = useCallback((house: HouseRecord) => {
    const verdict = check(house);
    const base = `${house.codigo}: ${house.activo ? houseStatusLabels[house.estado] : "Inactiva"}${house.modelo ? `, ${house.modelo}` : ""}`;
    return verdict.ok ? base : `${base} — ${verdict.motivo ?? "No seleccionable"}`;
  }, [check]);
  const choose = useCallback((house: HouseRecord) => {
    const verdict = check(house);
    if (!verdict.ok) { setNotice(`${house.codigo} no se puede seleccionar: ${verdict.motivo ?? "no es elegible"}`); return; }
    setNotice("");
    onSelect(house);
  }, [check, onSelect]);
  const listed = houses.filter((h) => visibleStatus[h.estado]);

  return (
    <section aria-label={title} className={`min-w-0 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(houseStatusLabels) as HouseStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={visibleStatus[status]}
            onClick={() => setVisibleStatus((current) => ({ ...current, [status]: !current[status] }))}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition aria-[pressed=false]:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none"
          >
            <span className={`size-2.5 rounded-full ${statusDot[status]}`} aria-hidden="true" />
            {houseStatusLabels[status]}
            <span className="tabular-nums text-slate-500">{counts[status]}</span>
          </button>
        ))}
        <div className="ml-auto flex gap-1.5" role="group" aria-label="Vista del mapa">
          {can3D ? ([["3d", "Vista 3D", Box], ["aerea", "Vista aérea", MapIcon]] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 aria-[pressed=true]:border-blue-300 aria-[pressed=true]:bg-blue-50 aria-[pressed=true]:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Icon className="size-4" aria-hidden="true" />{label}
            </button>
          )) : null}
          <button type="button" aria-pressed={mode === "lista"} onClick={() => setView("lista")} disabled={!can3D && mode === "lista"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 aria-[pressed=true]:border-blue-300 aria-[pressed=true]:bg-blue-50 aria-[pressed=true]:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <List className="size-4" aria-hidden="true" />Lista
          </button>
        </div>
      </div>

      {notice ? <p role="status" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      {!webgl || failure ? (
        <p role="status" className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {failure || "El mapa 3D no está disponible en este navegador; se muestra la lista de viviendas."}
        </p>
      ) : null}

      {houses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No hay viviendas registradas.</div>
      ) : mode === "lista" ? (
        <ul className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Lista de viviendas">
          {listed.map((house) => {
            const verdict = check(house);
            const selected = house.id_casa === selectedId;
            return (
              <li key={house.id_casa}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={!verdict.ok}
                  title={verdict.ok ? undefined : verdict.motivo ?? undefined}
                  onClick={() => choose(house)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none ${selected ? "border-blue-600 ring-2 ring-blue-600" : "border-slate-200 hover:border-blue-300"} ${verdict.ok ? "" : "opacity-50"}`}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <span className={`size-2.5 rounded-full ${house.activo ? statusDot[house.estado] : "bg-slate-400"}`} aria-hidden="true" />
                    {house.codigo}
                  </span>
                  <span className="block text-xs text-slate-500">{house.activo ? houseStatusLabels[house.estado] : "Inactiva"}{verdict.ok ? "" : ` · ${verdict.motivo ?? "No seleccionable"}`}</span>
                </button>
              </li>
            );
          })}
          {listed.length === 0 ? <li className="col-span-full p-4 text-center text-sm text-slate-500">Ningún estado seleccionado en los filtros.</li> : null}
        </ul>
      ) : (
        <div className="relative aspect-[4/3] min-h-[300px] w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:aspect-[10/7]">
          <MapErrorBoundary onError={() => setFailure("No se pudo cargar el motor 3D; se muestra la lista de viviendas.")}>
            <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Cargando mapa 3D…</div>}>
              <HouseMap3D layout={layout} selectedId={selectedId} isDimmed={isDimmed} describe={describe} onSelect={choose} onFailure={setFailure} view={view === "lista" ? "3d" : view} />
            </Suspense>
          </MapErrorBoundary>
          <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600">Arrastra para girar · rueda o pellizca para acercar</p>
        </div>
      )}
    </section>
  );
}
