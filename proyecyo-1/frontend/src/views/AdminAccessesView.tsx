import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, Search, XCircle } from "lucide-react";

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
    icon: typeof CheckCircle2;
    label: string;
  }
> = {
  APROBADO: {
    className: "bg-emerald-100 text-emerald-700",
    iconClassName: "text-emerald-600",
    icon: CheckCircle2,
    label: "Aprobado",
  },
  PENDIENTE: {
    className: "bg-amber-100 text-amber-700",
    iconClassName: "text-amber-500",
    icon: Clock3,
    label: "Pendiente",
  },
  RECHAZADO: {
    className: "bg-rose-100 text-rose-700",
    iconClassName: "text-rose-600",
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
  "h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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
    <article className="rounded-[24px] border border-slate-200 bg-white px-7 py-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[1.05rem] text-slate-500">{label}</p>
      <p className={`mt-3 text-5xl font-medium tracking-tight ${accentClassName}`}>{value}</p>
    </article>
  );
}

export function AdminAccessesView() {
  const [summary, setSummary] = useState<AdminAccessSummary>({
    total_dia: 0,
    aprobados: 0,
    pendientes: 0,
    rechazados: 0,
  });
  const [accesses, setAccesses] = useState<AdminAccessRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<AdminAccessFilterType>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<AdminAccessFilterStatus>("APROBADO");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const filters = useMemo(
    () => ({
      search,
      type: selectedType,
      status: selectedStatus,
    }),
    [search, selectedStatus, selectedType],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAccessModule() {
      try {
        if (!cancelled) {
          setIsLoading(true);
          setErrorMessage("");
        }

        const [summaryResponse, accessesResponse] = await Promise.all([
          getAdminAccessSummaryRequest(),
          getAdminAccessesRequest(filters),
        ]);

        if (cancelled) {
          return;
        }

        setSummary(summaryResponse);
        setAccesses(accessesResponse);
        setLastUpdatedAt(new Date());
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

    void loadAccessModule();

    const intervalId = window.setInterval(() => {
      void loadAccessModule();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [filters]);

  return (
    <AdminLayout
      title="Control de Accesos"
      subtitle="Registro de ingresos y salidas del dia"
      actions={<span className="text-sm text-slate-500">Actualizado: {formatRefreshTime(lastUpdatedAt)}</span>}
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="mt-10 rounded-[28px] border border-slate-200 bg-white px-6 py-7 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por casa, nombre o placa..."
              className={`${fieldClassName} w-full pl-14`}
            />
          </div>

          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as AdminAccessFilterType)}
            className={`${fieldClassName} min-w-[220px]`}
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
            className={`${fieldClassName} min-w-[220px]`}
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
            className="inline-flex h-14 min-w-[196px] items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 text-lg font-medium text-white transition hover:bg-blue-700"
          >
            <Download className="size-5" />
            Exportar PDF
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        {errorMessage ? (
          <div className="border-b border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm uppercase tracking-[0.12em] text-slate-500">
                <th className="px-8 py-6 font-semibold">Hora</th>
                <th className="px-8 py-6 font-semibold">Tipo</th>
                <th className="px-8 py-6 font-semibold">Nombre</th>
                <th className="px-8 py-6 font-semibold">Casa / Unidad</th>
                <th className="px-8 py-6 font-semibold">Placa</th>
                <th className="px-8 py-6 font-semibold">Estado</th>
                <th className="px-8 py-6 font-semibold">Autorizado por</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-500">
                    Cargando accesos del dia...
                  </td>
                </tr>
              ) : accesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-500">
                    No hay accesos que coincidan con los filtros actuales.
                  </td>
                </tr>
              ) : (
                accesses.map((access) => {
                  const statusMeta = statusStyles[access.estado];
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr key={access.id_acceso} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-8 py-6 text-lg text-slate-900">
                        <div className="flex items-center gap-3">
                          <Clock3 className="size-5 text-slate-400" />
                          <span>{access.hora}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span
                          className={`inline-flex rounded-full px-4 py-2 text-sm font-medium ${typeBadgeStyles[access.tipo]}`}
                        >
                          {typeLabels[access.tipo]}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-lg text-slate-950">{access.nombre}</td>
                      <td className="px-8 py-6 text-lg text-slate-500">{access.casa_unidad}</td>
                      <td className="px-8 py-6 text-lg text-slate-500">{access.placa}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`size-5 ${statusMeta.iconClassName}`} />
                          <span
                            className={`inline-flex rounded-full px-4 py-2 text-sm font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-lg text-slate-500">{access.autorizado_por}</td>
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
