import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Clock3 } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { notifyResidentBadgesChanged } from "@/components/residente/residentBadges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getNotificationsRequest,
  getUnreadNotificationsRequest,
  markAllNotificationsAsReadRequest,
  markNotificationAsReadRequest,
} from "@/services/notificationsService";
import type { NotificationRecord } from "@/types/notifications";

export type NotificationFilter = "TODOS" | "SIN_LEER" | "COMUNICADOS" | "OTROS";

const filterOptions: { value: NotificationFilter; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "SIN_LEER", label: "Sin leer" },
  { value: "COMUNICADOS", label: "Comunicados" },
  { value: "OTROS", label: "Otros avisos" },
];

const typeLabels: Record<string, string> = {
  COMUNICADO: "Comunicado",
  LLEGADA_VISITA: "Visita",
  ACCESO_CANCELADO: "Acceso",
  ACCESO_ESPECIAL: "Acceso especial",
  SOLICITUD_AUTORIZACION: "Autorización",
  RECORDATORIO_RESERVA: "Reserva",
};

function matchesFilter(notification: NotificationRecord, filter: NotificationFilter) {
  if (filter === "SIN_LEER") return !notification.leido;
  if (filter === "COMUNICADOS") return notification.tipo === "COMUNICADO";
  if (filter === "OTROS") return notification.tipo !== "COMUNICADO";
  return true;
}

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type NotificationsViewProps = {
  initialFilter?: NotificationFilter;
  /** Rol cuyo layout envuelve la vista; ambos consultan solo sus propias notificaciones. */
  role?: "residente" | "inquilino";
};

export function ResidentNotificationsView({ initialFilter = "TODOS", role = "residente" }: NotificationsViewProps) {
  const [filter, setFilter] = useState<NotificationFilter>(initialFilter);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | "all" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getNotificationsRequest(), getUnreadNotificationsRequest()])
      .then(([records, counter]) => {
        if (!active) return;
        setNotifications(records);
        setUnread(counter.unread);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "No fue posible cargar las notificaciones.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markAsRead(notification: NotificationRecord) {
    if (notification.leido) return;
    try {
      setUpdatingId(notification.id_notificacion);
      setError("");
      const updated = await markNotificationAsReadRequest(notification.id_notificacion);
      setNotifications((current) => current.map((item) => (
        item.id_notificacion === updated.id_notificacion ? updated : item
      )));
      setUnread((current) => Math.max(0, current - 1));
      notifyResidentBadgesChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible actualizar la notificacion.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function markAllAsRead() {
    try {
      setUpdatingId("all");
      setError("");
      await markAllNotificationsAsReadRequest();
      setNotifications((current) => current.map((item) => ({ ...item, leido: true })));
      setUnread(0);
      notifyResidentBadgesChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible actualizar las notificaciones.");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => matchesFilter(notification, filter)),
    [notifications, filter],
  );

  return (
    <AppShell
      role={role}
      title="Comunicados y avisos"
      subtitle="Comunicados de la administración y avisos de su unidad."
      actions={
        <Button type="button" variant="outline" disabled={unread === 0 || updatingId !== null} onClick={() => void markAllAsRead()}>
          <CheckCheck className="size-4" />
          Marcar todas como leidas
        </Button>
      }
    >

      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Bell className="size-5 text-blue-700" /> Notificaciones</CardTitle>
            <CardDescription>Solo se muestran avisos asociados a su cuenta.</CardDescription>
          </div>
          {!loading ? (
            <span className="self-start rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 sm:self-auto" aria-label={`${unread} pendientes`}>
              {unread} pendiente{unread === 1 ? "" : "s"}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar avisos">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  filter === option.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {error ? <Alert variant="destructive" className="mb-4"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando notificaciones...</p> : null}
          {!loading && notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <Check className="mx-auto size-8 text-emerald-600" />
              <p className="mt-3 font-semibold text-slate-900">No tienes notificaciones</p>
              <p className="mt-1 text-sm text-slate-500">Los nuevos avisos apareceran en este espacio.</p>
            </div>
          ) : null}
          {!loading && notifications.length > 0 && visibleNotifications.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
              No hay avisos para el filtro seleccionado.
            </p>
          ) : null}
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <article
                key={notification.id_notificacion}
                className={`rounded-2xl border p-4 ${notification.leido ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/70"}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.leido ? <span className="size-2 rounded-full bg-blue-600" aria-label="Sin leer" /> : null}
                      <h2 className="font-semibold text-slate-950">{notification.titulo}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {typeLabels[notification.tipo] ?? "Aviso"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{notification.mensaje}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="size-3.5" /> {formatDate(notification.creado_en)}</p>
                  </div>
                  {!notification.leido ? (
                    <Button type="button" variant="outline" disabled={updatingId !== null} onClick={() => void markAsRead(notification)}>
                      <Check className="size-4" />
                      {updatingId === notification.id_notificacion ? "Actualizando..." : "Marcar como leida"}
                    </Button>
                  ) : <span className="text-xs font-semibold text-emerald-700">Leida</span>}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
