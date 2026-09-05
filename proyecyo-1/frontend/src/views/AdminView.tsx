import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getAdminAccessesRequest,
  getAdminAccessHourlyChartRequest,
  getAdminAccessSummaryRequest,
} from "@/services/adminAccessesService";
import { getAdminAmenityStatsRequest } from "@/services/amenitiesService";
import type { AdminAccessHourlyPoint, AdminAccessRecord, AdminAccessSummary } from "@/types/accesses";
import type { AmenityStatsResponse } from "@/types/amenities";

function buildDashboardCards(summary: AdminAccessSummary) {
  return [
    {
      label: "Accesos Hoy",
      value: String(summary.total_dia),
      icon: KeyRound,
      iconClassName: "bg-blue-50 text-blue-600",
      valueClassName: "text-slate-950",
    },
    {
      label: "Aprobados",
      value: String(summary.aprobados),
      icon: CheckCircle2,
      iconClassName: "bg-emerald-50 text-emerald-600",
      valueClassName: "text-emerald-600",
    },
    {
      label: "Pendientes",
      value: String(summary.pendientes),
      icon: Clock3,
      iconClassName: "bg-amber-50 text-amber-600",
      valueClassName: "text-amber-600",
    },
    {
      label: "Cancelados/Rechazados",
      value: String(summary.rechazados),
      icon: XCircle,
      iconClassName: "bg-rose-50 text-rose-600",
      valueClassName: "text-rose-600",
    },
  ];
}

const typeStyles: Record<string, string> = {
  RESIDENTE: "bg-blue-100 text-blue-700",
  VISITANTE: "bg-fuchsia-100 text-fuchsia-700",
  PROVEEDOR: "bg-amber-100 text-amber-700",
};

const typeLabels: Record<string, string> = {
  RESIDENTE: "Residente",
  VISITANTE: "Visitante",
  PROVEEDOR: "Proveedor",
};

const accessStatusStyles: Record<string, string> = {
  APROBADO: "bg-emerald-100 text-emerald-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  RECHAZADO: "bg-rose-100 text-rose-700",
};

const accessStatusLabels: Record<string, string> = {
  APROBADO: "Aprobado",
  PENDIENTE: "Pendiente",
  RECHAZADO: "Rechazado",
};

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

export function AdminView() {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState<AdminAccessSummary>({
    total_dia: 0,
    aprobados: 0,
    pendientes: 0,
    rechazados: 0,
  });
  const [accesses, setAccesses] = useState<AdminAccessRecord[]>([]);
  const [hourlyAccesses, setHourlyAccesses] = useState<AdminAccessHourlyPoint[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [statsFrom, setStatsFrom] = useState(today);
  const [statsTo, setStatsTo] = useState(today);
  const [amenityStats, setAmenityStats] = useState<AmenityStatsResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard(options: { silent?: boolean } = {}) {
      try {
        if (options.silent) {
          setIsRefreshing(true);
        }
        const [summaryResponse, hourlyResponse, accessesResponse] = await Promise.all([
          getAdminAccessSummaryRequest(),
          getAdminAccessHourlyChartRequest(),
          getAdminAccessesRequest({}),
        ]);
        if (active) {
          setSummary(summaryResponse);
          setHourlyAccesses(hourlyResponse);
          setAccesses(accessesResponse.slice(0, 6));
          setLastUpdatedAt(new Date());
          setRefreshError(false);
        }
      } catch {
        if (active) {
          setRefreshError(true);
        }
      } finally {
        if (active) {
          setIsRefreshing(false);
        }
      }
    }

    void loadDashboard();
    const interval = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    getAdminAmenityStatsRequest({ from: statsFrom, to: statsTo })
      .then((response) => {
        if (active) {
          setAmenityStats(response);
        }
      })
      .catch(() => {
        if (active) {
          setAmenityStats(null);
        }
      });

    return () => {
      active = false;
    };
  }, [statsFrom, statsTo]);

  const dashboardCards = buildDashboardCards(summary);
  const maxHourlyValue = useMemo(
    () => Math.max(1, ...hourlyAccesses.map((item) => item.total)),
    [hourlyAccesses],
  );
  const chartLabels = useMemo(
    () =>
      Array.from({ length: 5 }, (_unused, index) =>
        String(Math.round(maxHourlyValue - (maxHourlyValue / 4) * index)),
      ),
    [maxHourlyValue],
  );
  const compactHourlyAccesses = useMemo(
    () => hourlyAccesses.filter((_item, index) => index % 2 === 0),
    [hourlyAccesses],
  );
  const maxAmenityReservations = Math.max(
    1,
    ...(amenityStats?.por_amenidad.map((item) => item.total_reservas) || [1]),
  );

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Resumen general del residencial"
      actions={
        <div className="flex items-center gap-3 text-xs">
          {refreshError ? (
            <span className="inline-flex items-center gap-1.5 text-rose-700">
              <span className="size-2 rounded-full bg-rose-500" />
              Sincronizacion fallida
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span
                className={`size-2 rounded-full bg-emerald-500 ${isRefreshing ? "animate-ping" : "animate-pulse"}`}
              />
              En vivo
            </span>
          )}
          <span className="text-slate-500">Actualizado: {formatRefreshTime(lastUpdatedAt)}</span>
        </div>
      }
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map(({ label, value, icon: Icon, iconClassName, valueClassName }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.82rem] text-slate-500">{label}</p>
                <p className={`mt-2 text-3xl font-medium tracking-tight ${valueClassName}`}>{value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${iconClassName}`}>
                <Icon className="size-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[1.24rem] font-semibold text-slate-950">Estadisticas de amenidades</h2>
            <p className="text-sm text-slate-500">Uso, ranking y reservas por amenidad con datos reales.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={statsFrom}
              onChange={(event) => setStatsFrom(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <input
              type="date"
              value={statsTo}
              onChange={(event) => setStatsTo(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
          <div className="space-y-3">
            {(amenityStats?.por_amenidad || []).map((item) => (
              <div key={item.id_amenidad} className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_90px] md:items-center">
                <p className="text-sm font-medium text-slate-700">{item.nombre}</p>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(4, (item.total_reservas / maxAmenityReservations) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-slate-500">{item.total_reservas} reservas</p>
              </div>
            ))}
            {!amenityStats?.por_amenidad.length ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Sin reservas en el rango.</p>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Ranking</p>
            <div className="mt-3 space-y-2">
              {(amenityStats?.ranking || []).slice(0, 5).map((item) => (
                <div key={item.id_amenidad} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span className="text-sm text-slate-700">
                    {item.ranking}. {item.nombre}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{item.activas}</span>
                </div>
              ))}
              {!amenityStats?.ranking.length ? (
                <p className="text-sm text-slate-500">Sin ranking disponible.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-[1.24rem] font-semibold text-slate-950">Accesos en Tiempo Real</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3 font-semibold">Hora</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Unidad</th>
                  <th className="px-5 py-3 font-semibold">Placa</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {accesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                      No hay accesos registrados para hoy.
                    </td>
                  </tr>
                ) : (
                  accesses.map((row) => (
                    <tr key={row.id_acceso} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 py-3 text-sm text-slate-900">{row.hora}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${typeStyles[row.tipo]}`}>
                          {typeLabels[row.tipo]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-950">{row.nombre}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{row.casa_unidad}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{row.placa}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${accessStatusStyles[row.estado]}`}>
                          {accessStatusLabels[row.estado]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-[1.24rem] font-semibold text-slate-950">Accesos por Hora</h2>

          <div className="mt-4 flex gap-2.5">
            <div className="flex h-[250px] flex-col justify-between pb-6 text-[0.74rem] text-slate-500">
              {chartLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>

            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-0 rounded-[20px] border border-slate-200">
                {[0, 1, 2, 3].map((line) => (
                  <div
                    key={line}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-300"
                    style={{ top: `${line * 25}%` }}
                  />
                ))}
              </div>

              <div className="relative flex h-[250px] items-end gap-2 px-2.5 pb-8 pt-4">
                {compactHourlyAccesses.map((item) => (
                  <div key={item.hora} className="flex flex-1 flex-col items-center justify-end gap-3">
                    <div
                      className="w-full max-w-[20px] rounded-t-md bg-blue-500"
                      style={{ height: `${(item.total / maxHourlyValue) * 195}px` }}
                      title={`${item.hora}: ${item.total} accesos`}
                    />
                    <span className="text-[0.7rem] text-slate-500">
                      {Number(item.hora.slice(0, 2)) % 4 === 2 ? item.hora : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        {[
          {
            title: "Monitoreo de accesos",
            text: "Registro del dia con busqueda por nombre, unidad o placa y filtros por tipo y estado.",
            icon: UserRound,
          },
          {
            title: "Mantenimiento",
            text: "Espacio secundario para avisos o recordatorios operativos del turno.",
            icon: Wrench,
          },
          {
            title: "Reservas",
            text: "El dashboard mantiene el mismo lenguaje visual para cada seccion administrativa.",
            icon: CalendarDays,
          },
        ].map(({ title, text, icon: Icon }) => {
          const body = (
            <>
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 text-[1.12rem] font-semibold text-slate-950">{title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-5 text-slate-500">{text}</p>
            </>
          );

          if (title === "Monitoreo de accesos") {
            return (
              <Link
                key={title}
                to="/admin/accesos"
                className="block rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:border-blue-200 hover:shadow-[0_12px_36px_rgba(37,99,235,0.08)]"
              >
                {body}
                <p className="mt-3 text-[0.78rem] font-medium text-blue-600">Ir a control con filtros</p>
              </Link>
            );
          }

          return (
            <article
              key={title}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            >
              {body}
            </article>
          );
        })}
      </section>

      <section className="mt-5">
        <UsersManagement />
      </section>
    </AdminLayout>
  );
}
