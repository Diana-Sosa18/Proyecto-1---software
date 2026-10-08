import { Pencil, Power, RefreshCw, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HouseDetail } from "@/types/houses";
import { houseStatusLabels } from "./HouseMap";

export const formatQuetzales = (value: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);
const orDash = (value: string | number | null | undefined, suffix = "") => (value == null || value === "" ? "—" : `${value}${suffix}`);

export const statusBadge: Record<string, string> = {
  DISPONIBLE: "bg-emerald-100 text-emerald-800",
  OCUPADA: "bg-blue-100 text-blue-800",
  INACTIVA: "bg-slate-200 text-slate-700",
};

interface HouseDetailPanelProps {
  detail: HouseDetail | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onEdit?: (detail: HouseDetail) => void;
  onToggleActive?: (detail: HouseDetail) => void;
  busy?: boolean;
}

export function HouseDetailPanel({ detail, loading, error, onRetry, onEdit, onToggleActive, busy = false }: HouseDetailPanelProps) {
  if (loading) return <p className="text-sm text-slate-500" role="status">Cargando vivienda…</p>;
  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
        <p>{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw className="size-4" />Reintentar</Button>
      </div>
    );
  }
  if (!detail) return <p className="text-sm text-slate-500">Selecciona una vivienda en el mapa o en la lista para ver sus detalles.</p>;

  const rows: Array<[string, string]> = [
    ["Torre / manzana", orDash(detail.torre)],
    ["Modelo", orDash(detail.modelo)],
    ["Terreno", orDash(detail.area_terreno, " m²")],
    ["Construcción", orDash(detail.area_construccion, " m²")],
    ["Habitaciones", orDash(detail.habitaciones)],
    ["Baños", orDash(detail.banos)],
    ["Niveles", orDash(detail.niveles)],
    ["Posición en mapa", detail.mapa_fila ? `Fila ${detail.mapa_fila}, columna ${detail.mapa_columna}` : "Automática"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Casa {detail.codigo}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[detail.estado]}`}>{houseStatusLabels[detail.estado]}</span>
          {!detail.activo ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge.INACTIVA}`}>Inactiva</span> : null}
        </div>
        <p className="mt-3 text-xl font-medium text-slate-900">{formatQuetzales(detail.precio)}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-xl border border-slate-200 p-3 text-sm">
        <p className="mb-1.5 font-semibold text-slate-900">Residente</p>
        {detail.residente ? (
          <div className="flex gap-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{detail.residente.nombre}</p>
              <p className="break-all text-slate-600">{detail.residente.correo}</p>
              <p className="text-slate-600">{detail.residente.telefono || "Sin teléfono"}</p>
            </div>
          </div>
        ) : <p className="text-slate-500">Sin residente: la vivienda está disponible.</p>}
      </div>

      <div className="rounded-xl border border-slate-200 p-3 text-sm">
        <p className="mb-1.5 font-semibold text-slate-900">Inquilinos ({detail.inquilinos.length})</p>
        {detail.inquilinos.length ? (
          <ul className="space-y-1.5">
            {detail.inquilinos.map((tenant) => (
              <li key={tenant.id_usuario} className="min-w-0">
                <span className="font-medium text-slate-900">{tenant.nombre}</span>
                <span className="block break-all text-slate-600">{tenant.correo}</span>
                <span className="text-xs text-slate-500">{tenant.autorizado ? "Autorizado" : "Sin autorizar"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-500">Sin inquilinos asociados.</p>}
      </div>

      {onEdit || onToggleActive ? (
        <div className="flex flex-wrap gap-2">
          {onEdit ? <Button type="button" onClick={() => onEdit(detail)} disabled={busy}><Pencil className="size-4" />Editar vivienda</Button> : null}
          {onToggleActive ? (
            <Button type="button" variant="outline" onClick={() => onToggleActive(detail)} disabled={busy || (detail.activo && detail.estado === "OCUPADA")}
              title={detail.activo && detail.estado === "OCUPADA" ? "No se puede desactivar una vivienda ocupada." : undefined}>
              <Power className="size-4" />{detail.activo ? "Desactivar" : "Activar"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {detail.activo && detail.estado === "OCUPADA" && onToggleActive ? (
        <p className="text-xs text-slate-500">Una vivienda ocupada no se puede desactivar. Las viviendas no se eliminan: conservan su historial (cuotas, pagos y accesos).</p>
      ) : null}
    </div>
  );
}
