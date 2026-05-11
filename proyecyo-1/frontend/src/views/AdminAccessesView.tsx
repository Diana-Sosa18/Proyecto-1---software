import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, RefreshCw, Search, XCircle } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getAdminAccessesRequest,
  getAdminAccessSummaryRequest,
} from "@/services/adminAccessesService";
import type {
  AdminAccessFilterStatus,
  AdminAccessFilterType,
  AdminAccessRecord,
  AdminAccessStatus,
  AdminAccessSummary,
  AdminAccessType,
} from "@/types/accesses";

const typeOptions: Array<{ value: AdminAccessFilterType; label: string }> = [
  { value: "TODOS", label: "Todos los tipos" },
  { value: "RESIDENTE", label: "Residente" },
  { value: "VISITANTE", label: "Visitante" },
  { value: "PROVEEDOR", label: "Proveedor" },
];

const statusOptions: Array<{ value: AdminAccessFilterStatus; label: string }> = [
  { value: "TODOS", label: "Todos los estados" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const typeBadgeStyles: Record<AdminAccessType, string> = {
  RESIDENTE: "bg-blue-100 text-blue-700",
  VISITANTE: "bg-fuchsia-100 text-fuchsia-700",
  PROVEEDOR: "bg-amber-100 text-amber-700",
};

const typeLabels: Record<AdminAccessType, string> = {
  RESIDENTE: "Residente",
  VISITANTE: "Visitante",
  PROVEEDOR: "Proveedor",
};

const statusStyles: Record<
  AdminAccessStatus,
  {
    className: string;
    iconClassName: string;
    dotClassName: string;
    icon: typeof CheckCircle2;
    label: string;
  }
> = {
  APROBADO: {
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    iconClassName: "text-emerald-600",
    dotClassName: "bg-emerald-500",
    icon: CheckCircle2,
    label: "Aprobado",
  },
  PENDIENTE: {
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    iconClassName: "text-amber-500",
    dotClassName: "bg-amber-500 animate-pulse",
    icon: Clock3,
    label: "Pendiente",
  },
  RECHAZADO: {
    className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    iconClassName: "text-rose-600",
    dotClassName: "bg-rose-500",
    icon: XCircle,
    label: "Rechazado",
  },
};

const cardAccentStyles = {
  total: "text-slate-950",
  approved: "text-emerald-600",
  pending: "text-amber-500",
  rejected: "text-rose-600",
};

const fieldClassName =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-[0.82rem] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function formatRefreshTime(date: Date | null) {
  if (!date) {
    return "Sin sincronizar";
  }

  return new Intl.DateTimeFormat("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function SummaryCard({
  label,
  value,
  accentClassName,
}: {
  label: string;
  value: number;
  accentClassName: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[0.82rem] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-3xl font-medium tracking-tight ${accentClassName}`}>{value}</p>
    </article>
  );
}

const REFRESH_INTERVAL_MS = 10000;

export function AdminAccessesView() {
  const [summary, setSummary] = useState<AdminAccessSummary>({
    total_dia: 0,
    aprobados: 0,
    pendientes: 0,
    rechazados: 0,
  });
  const [accesses, setAccesses] = useState<AdminAccessRecord[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [house, setHouse] = useState("");
  const [debouncedHouse, setDebouncedHouse] = useState("");
  const [plate, setPlate] = useState("");
  const [debouncedPlate, setDebouncedPlate] = useState("");
  const [selectedType, setSelectedType] = useState<AdminAccessFilterType>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<AdminAccessFilterStatus>("TODOS");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedHouse(house);
      setDebouncedPlate(plate);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [house, plate, search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      house: debouncedHouse,
      plate: debouncedPlate,
      type: selectedType,
      status: selectedStatus,
    }),
    [debouncedHouse, debouncedPlate, debouncedSearch, selectedStatus, selectedType],
  );

  const loadAccessModule = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;

      try {
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
    async function loadSummary() {
      try {
        if (!cancelled) {
          setErrorMessage("");
        }
        setErrorMessage("");

        const summaryResponse = await getAdminAccessSummaryRequest();

        setSummary(summaryResponse);
        setLastUpdatedAt(new Date());
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible cargar el Control de Accesos.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No fue posible cargar el Control de Accesos.",
          );
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    void loadAccessModule();

    const intervalId = window.setInterval(() => {
      void loadAccessModule({ silent: true });
    }, REFRESH_INTERVAL_MS);
    void loadSummary();

    const intervalId = window.setInterval(() => {
      void loadSummary();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadAccessModule]);

  const handleManualRefresh = useCallback(() => {
    void loadAccessModule({ silent: true });
  }, [loadAccessModule]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAccesses() {
      try {
        if (!cancelled) {
          setIsLoading(true);
          setErrorMessage("");
        }

        const accessesResponse = await getAdminAccessesRequest(filters);

        if (cancelled) {
          return;
        }

        setAccesses(accessesResponse);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No fue posible cargar el Control de Accesos.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAccesses();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <AdminLayout
      title="Control de Accesos"
      subtitle="Registro de ingresos y salidas del dia"
      actions={
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            En vivo
          </span>
          <span className="text-sm text-slate-500">
            Actualizado: {formatRefreshTime(lastUpdatedAt)}
          </span>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            aria-label="Actualizar ahora"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      }
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total del dia"
          value={summary.total_dia}
          accentClassName={cardAccentStyles.total}
        />
        <SummaryCard
          label="Aprobados"
          value={summary.aprobados}
          accentClassName={cardAccentStyles.approved}
        />
        <SummaryCard
          label="Pendientes"
          value={summary.pendientes}
          accentClassName={cardAccentStyles.pending}
        />
        <SummaryCard
          label="Rechazados"
          value={summary.rechazados}
          accentClassName={cardAccentStyles.rejected}
        />
      </section>

      <section
        className="mt-5 rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
        aria-labelledby="admin-accesses-filters-heading"
      >
        <h2
          id="admin-accesses-filters-heading"
          className="mb-3 text-[0.92rem] font-semibold text-slate-800"
        >
          Filtros de accesos
        </h2>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre..."
              aria-label="Buscar accesos por nombre"
              className={`${fieldClassName} w-full pl-11`}
            />
          </div>

          <input
            value={house}
            onChange={(event) => setHouse(event.target.value)}
            placeholder="Filtrar por casa/unidad..."
            aria-label="Filtrar accesos por casa o unidad"
            className={`${fieldClassName} min-w-[210px]`}
          />

          <input
            value={plate}
            onChange={(event) => setPlate(event.target.value)}
            placeholder="Filtrar por placa..."
            aria-label="Filtrar accesos por placa"
            className={`${fieldClassName} min-w-[200px]`}
          />

          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as AdminAccessFilterType)}
            className={`${fieldClassName} min-w-[190px]`}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as AdminAccessFilterStatus)}
            className={`${fieldClassName} min-w-[190px]`}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Download className="size-4" />
            Exportar PDF
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        {errorMessage ? (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-5 py-3 font-semibold" title="Hora de ingreso">Hora ingreso</th>
                <th className="px-5 py-3 font-semibold" title="Hora de salida si fue registrada">Hora salida</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Nombre</th>
                <th className="px-5 py-3 font-semibold">Casa / Unidad</th>
                <th className="px-5 py-3 font-semibold">Placa</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Autorizado por</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    Cargando accesos del dia...
                  </td>
                </tr>
              ) : accesses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    No hay accesos que coincidan con los filtros actuales.
                  </td>
                </tr>
              ) : (
                accesses.map((access) => {
                  const statusMeta = statusStyles[access.estado];
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr key={access.id_acceso} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 py-3 text-sm text-slate-900">
                        <div className="flex items-center gap-2">
                          <Clock3 className="size-4 text-slate-400" />
                          <span>{access.hora}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {access.hora_salida ? access.hora_salida : <span className="text-slate-300">--:--</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${typeBadgeStyles[access.tipo]}`}
                        >
                          {typeLabels[access.tipo]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-950">{access.nombre}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{access.casa_unidad}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{access.placa}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${statusMeta.className}`}
                        >
                          <span className={`size-1.5 rounded-full ${statusMeta.dotClassName}`} />
                          <StatusIcon className={`size-3.5 ${statusMeta.iconClassName}`} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">{access.autorizado_por}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}
