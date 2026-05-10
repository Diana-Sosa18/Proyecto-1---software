import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, CheckCheck, Home, UserRoundCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getNotificationsRequest,
  markAllNotificationsAsReadRequest,
  markNotificationAsReadRequest,
} from "@/services/notificationsService";
import { getVisitsRequest } from "@/services/visitsService";
import type { NotificationRecord } from "@/types/notifications";
import type { VisitRecord } from "@/types/visits";

export function ResidenteView() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationsError, setNotificationsError] = useState("");

  useEffect(() => {
    let active = true;

    getVisitsRequest()
      .then((response) => {
        if (active) {
          setVisits(response);
        }
      })
      .catch(() => {
        if (active) {
          setVisits([]);
        }
      });

    getNotificationsRequest()
      .then((response) => {
        if (active) {
          setNotifications(response);
        }
      })
      .catch((error) => {
        if (active) {
          setNotificationsError(
            error instanceof Error ? error.message : "No fue posible cargar las notificaciones.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const todayVisits = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visits.filter((visit) => visit.fecha === today).length;
  }, [visits]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.leido),
    [notifications],
  );

  async function markNotificationAsRead(notificationId: number) {
    try {
      const updated = await markNotificationAsReadRequest(notificationId);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id_notificacion === updated.id_notificacion ? updated : notification,
        ),
      );
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "No fue posible marcar la notificacion como leida.",
      );
    }
  }

  async function markAllAsRead() {
    try {
      await markAllNotificationsAsReadRequest();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          leido: true,
        })),
      );
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "No fue posible marcar las notificaciones como leidas.",
      );
    }
  }

  return (
    <AppShell
      role="residente"
      title="Panel de Residente"
      subtitle="Visitas, amenidades, avisos y operacion diaria de su unidad residencial."
    >
      {notificationsError ? (
        <Alert variant="destructive">
          <AlertTitle>Error en notificaciones</AlertTitle>
          <AlertDescription>{notificationsError}</AlertDescription>
        </Alert>
      ) : null}

      {unreadNotifications.length > 0 ? (
        <Alert className="border-blue-200 bg-blue-50 text-blue-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <AlertTitle className="flex items-center gap-2 text-lg">
                <Bell className="size-5" />
                Tienes {unreadNotifications.length} notificacion
                {unreadNotifications.length === 1 ? "" : "es"} de llegada
              </AlertTitle>

              <AlertDescription className="mt-3 space-y-3 text-blue-900">
                {unreadNotifications.slice(0, 3).map((notification) => (
                  <div
                    key={notification.id_notificacion}
                    className="rounded-2xl border border-blue-100 bg-white/80 p-3"
                  >
                    <p className="font-semibold">{notification.titulo}</p>
                    <p className="text-sm">{notification.mensaje}</p>

                    <button
                      type="button"
                      onClick={() => void markNotificationAsRead(notification.id_notificacion)}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-950"
                    >
                      Marcar como leida
                    </button>
                  </div>
                ))}
              </AlertDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void markAllAsRead()}
              className="rounded-2xl border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
            >
              <CheckCheck className="size-4" />
              Marcar todas
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visitas autorizadas"
          value={String(visits.length)}
          helper={`${todayVisits} programadas para hoy`}
          icon={UserRoundCheck}
          onClick={() => navigate("/residente/visitas")}
        />

        <StatCard
          label="Reservas"
          value="2"
          helper="Salon y cancha activos"
          icon={CalendarDays}
        />

        <StatCard
          label="Avisos"
          value={String(unreadNotifications.length)}
          helper={
            unreadNotifications.length === 0
              ? "Sin notificaciones pendientes"
              : "Llegadas sin leer"
          }
          icon={Bell}
        />

        <StatCard
          label="Unidad"
          value="B-302"
          helper="Estado al dia"
          icon={Home}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Visitas",
            description: "Autorice ingresos temporales, recurrentes o permanentes.",
            path: "/residente/visitas",
          },
          {
            title: "Amenidades",
            description: "Consulte disponibilidad y confirme sus reservas.",
            path: "/residente/amenidades",
          },
          {
            title: "Comunidad",
            description: "Revise avisos, mantenimientos y novedades del residencial.",
          },
        ].map((section) => (
          <Card
            key={section.title}
            className={
              section.path
                ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                : ""
            }
            onClick={section.path ? () => navigate(section.path) : undefined}
          >
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Modulo listo para conectar con sus datos reales desde la API.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}