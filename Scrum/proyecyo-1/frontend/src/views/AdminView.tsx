import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CreditCard,
  Filter,
  KeyRound,
  Megaphone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminAccessesRequest } from "@/services/adminAccessesService";
import type { AdminAccessRecord, AdminAccessStatus } from "@/types/accesses";

type AccessFilter = "TODOS" | AdminAccessStatus;

const statusLabels: Record<AdminAccessStatus, string> = {
  AUTORIZADA: "Aprobado",
  INGRESO_REGISTRADO: "Ingreso registrado",
  CANCELADA: "Rechazado",
};

const statusClasses: Record<AdminAccessStatus, string> = {
  AUTORIZADA: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  INGRESO_REGISTRADO: "bg-blue-50 text-blue-700 border border-blue-200",
  CANCELADA: "bg-rose-50 text-rose-700 border border-rose-200",
};

export function AdminView() {
  const [accesses, setAccesses] = useState<AdminAccessRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<AccessFilter>("TODOS");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadAccesses = async (showSkeleton = false) => {
    try {
      if (showSkeleton) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setErrorMessage("");
      const data = await getAdminAccessesRequest(selectedStatus);
      setAccesses(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los accesos.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAccesses(true);
  }, [selectedStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadAccesses(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [selectedStatus]);

  const totalAccesses = accesses.length;
  const approvedCount = useMemo(
    () => accesses.filter((access) => access.estado === "AUTORIZADA").length,
    [accesses],
  );
  const registeredCount = useMemo(
    () => accesses.filter((access) => access.estado === "INGRESO_REGISTRADO").length,
    [accesses],
  );
  const rejectedCount = useMemo(
    () => accesses.filter((access) => access.estado === "CANCELADA").length,
    [accesses],
  );

  return (
    <AppShell
      role="admin"
      title="Panel Administrativo"
      subtitle="Supervision operativa, accesos en tiempo real, cobranzas, comunicacion y gestion de usuarios."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accesos visibles"
          value={String(totalAccesses)}
          helper="Tabla actualizada en tiempo real"
          icon={KeyRound}
        />
        <StatCard
          label="Aprobados"
          value={String(approvedCount)}
          helper="Accesos autorizados"
          icon={ShieldCheck}
        />
        <StatCard
          label="Registrados"
          value={String(registeredCount)}
          helper="Ingreso ya marcado"
          icon={CreditCard}
        />
        <StatCard
          label="Rechazados"
          value={String(rejectedCount)}
          helper="Accesos cancelados"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen ejecutivo</CardTitle>
            <CardDescription>Estado general de los accesos dentro de la residencial.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Accesos", "Consulta en tiempo real los ingresos autorizados y registrados."],
              ["Filtros", "Filtra por estado para identificar aprobados o rechazados."],
              ["Control", "La tabla muestra hora, nombre, casa, placa y estado."],
              ["Actualizacion", "La informacion se refresca automaticamente cada 10 segundos."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones recomendadas</CardTitle>
            <CardDescription>Acciones rapidas del turno administrativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Verificar accesos aprobados del dia.",
              "Revisar registros cancelados para detectar incidencias.",
              "Monitorear ingresos ya registrados por garita.",
              "Confirmar que la informacion de visitantes este completa.",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">Visualizar accesos</CardTitle>
              <CardDescription className="mt-2 text-sm text-slate-600">
                Tabla de accesos en tiempo real con filtros por estado y badges visuales.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
                <Megaphone className="size-4" />
                Monitoreo administrativo
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Filter className="size-4 text-slate-500" />
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value as AccessFilter)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="TODOS">Todos</option>
                  <option value="AUTORIZADA">Aprobado</option>
                  <option value="INGRESO_REGISTRADO">Ingreso registrado</option>
                  <option value="CANCELADA">Rechazado</option>
                </select>
              </div>

              <Button variant="outline" onClick={() => void loadAccesses(false)} disabled={isRefreshing}>
                <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-slate-200 bg-white/95">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Tabla de accesos</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Columnas solicitadas: hora, nombre, casa, placa y estado.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Cargando accesos...
            </div>
          ) : null}

          {!isLoading && accesses.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No hay accesos para mostrar con el filtro actual.
            </div>
          ) : null}

          {!isLoading && accesses.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Casa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Placa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {accesses.map((access) => (
                    <tr key={access.id_acceso} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-sm text-slate-700">{access.hora}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">{access.nombre}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{access.casa}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{access.placa}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses[access.estado]}`}
                        >
                          {statusLabels[access.estado]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <UsersManagement />
    </AppShell>
  );
}