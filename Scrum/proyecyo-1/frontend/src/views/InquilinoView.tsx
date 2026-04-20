import { useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Plus,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";

import { StatCard } from "@/components/layout/StatCard";

import { PermissionRequestModal } from "@/components/inquilino/PermissionRequestModal";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  cancelPermissionRequestRequest,
  createPermissionRequestRequest,
  getOwnPermissionRequestsRequest,
} from "@/services/permissionRequestsService";

import type {
  CreatePermissionRequestPayload,
  PermissionRequestRecord,
  PermissionRequestStatus,
} from "@/types/permissionRequests";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";


const statusStyles: Record<PermissionRequestStatus, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  APROBADO: "bg-emerald-50 text-emerald-700",
  RECHAZADO: "bg-rose-50 text-rose-700",
  CANCELADA: "bg-slate-100 text-slate-700",
};

const statusLabels: Record<PermissionRequestStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  CANCELADA: "Cancelada",
};

export function InquilinoView() {
  const [requests, setRequests] = useState<PermissionRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingId, setIsCancellingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");


  useEffect(() => {
    void loadRequests();
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.estado === "PENDIENTE").length,
    [requests]
  );

  const approvedCount = useMemo(
    () => requests.filter((request) => request.estado === "APROBADO").length,
    [requests]
  );

  const rejectedCount = useMemo(
    () => requests.filter((request) => request.estado === "RECHAZADO").length,
    [requests]
  );

  const handleCreateRequest = async (values: CreatePermissionRequestPayload) => {
  try {
    setIsSubmitting(true);
    await createPermissionRequestRequest(values);
    setIsModalOpen(false);
    await loadRequests();
  } finally {
    setIsSubmitting(false);
  }
};

  const handleCancelRequest = async (id: number) => {
  const confirmed = window.confirm("¿Deseas cancelar esta solicitud?");

  if (!confirmed) {
    return;
  }

  try {
    setIsCancellingId(id);
    await cancelPermissionRequestRequest(id);
    await loadRequests();
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "No se pudo cancelar la solicitud.");
  } finally {
    setIsCancellingId(null);
  }
};

  return (
    <AppShell
      role="inquilino"
      title="Panel de Inquilino"
      subtitle="Solicita permisos, consulta el estado de tus solicitudes y da seguimiento a cada gestión."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Solicitudes totales"
          value={String(requests.length)}
          helper="Historial general del inquilino"
          icon={FileText}
        />
        <StatCard
          label="Pendientes"
          value={String(pendingCount)}
          helper="Aún esperan respuesta"
          icon={Clock3}
        />
        <StatCard
          label="Aprobadas"
          value={String(approvedCount)}
          helper="Permisos ya autorizados"
          icon={CheckCircle2}
        />
        <StatCard
          label="Rechazadas"
          value={String(rejectedCount)}
          helper="Solicitudes no aprobadas"
          icon={CreditCard}
        />
      </div>

      <Card className="border-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">Solicitar permisos</CardTitle>
              <CardDescription className="mt-2 text-sm text-slate-600">
                Crea nuevas solicitudes y revisa el estado de cada una.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
                <ShieldCheck className="size-4" />
                Gestión digital de permisos
              </div>

              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="size-4" />
                Solicitar permiso
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-slate-200 bg-white/95">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Mis solicitudes</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Aquí puedes ver solicitudes pendientes, aprobadas, rechazadas o canceladas.
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
              Cargando solicitudes...
            </div>
          ) : null}

          {!isLoading && requests.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Todavía no has creado solicitudes.
            </div>
          ) : null}

          {!isLoading &&
            requests.map((request) => (
              <article
                key={request.id_solicitud_permiso}
                className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <UserCheck className="size-5" />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{request.tipo_permiso}</h3>
                        <p className="text-sm text-slate-500">{request.motivo}</p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.estado]}`}
                      >
                        {statusLabels[request.estado]}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Inicio</p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{request.fecha_inicio}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fin</p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{request.fecha_fin}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Creada</p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{request.created_at}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">Observaciones</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {request.observaciones || "Sin observaciones adicionales."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:w-[220px]">
                    <div className="rounded-2xl bg-slate-900 p-4 text-white">
                      <p className="text-sm text-slate-300">Estado actual</p>
                      <p className="mt-2 text-lg">{statusLabels[request.estado]}</p>
                    </div>

                    {request.estado === "PENDIENTE" ? (
                      <Button
                        variant="outline"
                        onClick={() => handleCancelRequest(request.id_solicitud_permiso)}
                        disabled={isCancellingId === request.id_solicitud_permiso}
                      >
                        <XCircle className="size-4" />
                        {isCancellingId === request.id_solicitud_permiso
                          ? "Cancelando..."
                          : "Cancelar solicitud"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
        </CardContent>
      </Card>

      <PermissionRequestModal
        isOpen={isModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateRequest}
      />
    </AppShell>
  );
}