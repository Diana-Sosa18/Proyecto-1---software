import { useEffect, useMemo, useState } from "react";
import { Bell, BriefcaseBusiness, CalendarDays, CheckCheck, Home, ShieldCheck, UserRoundCheck } from "lucide-react";
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
import {
  getOwnerProvidersRequest,
  updateOwnerProviderValidationRequest,
} from "@/services/providersService";
import { getVisitsRequest } from "@/services/visitsService";
import type { NotificationRecord } from "@/types/notifications";
import type { AdminProviderRecord } from "@/types/providers";
import type { VisitRecord } from "@/types/visits";

export function ResidenteView() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [providers, setProviders] = useState<AdminProviderRecord[]>([]);
  const [notificationsError, setNotificationsError] = useState("");
  const [providersError, setProvidersError] = useState("");
  const [validatingProviderId, setValidatingProviderId] = useState<number | null>(null);

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

    getOwnerProvidersRequest()
      .then((response) => {
        if (active) {
          setProviders(response);
        }
      })
      .catch((error) => {
        if (active) {
          setProvidersError(
            error instanceof Error ? error.message : "No fue posible cargar los proveedores por validar.",
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
  const pendingProviders = useMemo(
    () => providers.filter((provider) => provider.estado === "PENDIENTE"),
    [providers],
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

  async function validateProvider(provider: AdminProviderRecord) {
    try {
      setValidatingProviderId(provider.id_servicio);
      setProvidersError("");
      const updated = await updateOwnerProviderValidationRequest({
        id_servicio: provider.id_servicio,
        id_casa: provider.id_casa,
        estado: "VALIDADO",
        activo: true,
      });

      setProviders((current) =>
        current.map((item) =>
          item.id_servicio === updated.id_servicio && item.id_casa === updated.id_casa ? updated : item,
        ),
      );
    } catch (error) {
      setProvidersError(
        error instanceof Error ? error.message : "No fue posible validar el proveedor.",
      );
    } finally {
      setValidatingProviderId(null);
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
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <AlertTitle className="flex items-center gap-2 text-lg">
                <Bell className="size-5" />
                Tienes {unreadNotifications.length} notificacion
                {unreadNotifications.length === 1 ? "" : "es"} de llegada
              </AlertTitle>

              <AlertDescription className="mt-3 space-y-3 text-green-900">
                {unreadNotifications.slice(0, 3).map((notification) => (
                  <div
                    key={notification.id_notificacion}
                    className="rounded-2xl border border-green-100 bg-white/80 p-3"
                  >
                    <p className="font-semibold">{notification.titulo}</p>
                    <p className="text-sm">{notification.mensaje}</p>

                    <button
                      type="button"
                      onClick={() => void markNotificationAsRead(notification.id_notificacion)}
                      className="mt-2 text-xs font-semibold text-green-700 hover:text-green-950"
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
              className="rounded-2xl border-green-200 bg-white text-green-700 hover:bg-green-100"
            >
              <CheckCheck className="size-4" />
              Marcar todas
            </Button>
          </div>
        </Alert>
      ) : null}

      {providersError ? (
        <Alert variant="destructive">
          <AlertTitle>Error en proveedores</AlertTitle>
          <AlertDescription>{providersError}</AlertDescription>
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
          label="Proveedores"
          value={String(pendingProviders.length)}
          helper={
            pendingProviders.length === 0
              ? "Sin validaciones pendientes"
              : "Pendientes de validar"
          }
          icon={BriefcaseBusiness}
        />

        <StatCard
          label="Unidad"
          value="B-302"
          helper="Estado al dia"
          icon={Home}
        />
      </div>

      <Card className="border-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <BriefcaseBusiness className="size-5 text-blue-600" />
                Validacion de proveedores
              </CardTitle>
              <CardDescription>
                Proveedores registrados por inquilinos que requieren aprobacion del propietario.
              </CardDescription>
            </div>
            <div className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              {pendingProviders.length} pendientes
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {providers.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              No hay proveedores asociados a tu unidad.
            </div>
          ) : (
            providers.slice(0, 6).map((provider) => {
              const isValidating = validatingProviderId === provider.id_servicio;

              return (
                <article
                  key={`${provider.id_casa}-${provider.id_servicio}`}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_170px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{provider.nombre}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          provider.estado === "VALIDADO"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {provider.estado === "VALIDADO" ? "Aprobado" : "Pendiente"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{provider.descripcion}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Unidad {provider.casa_unidad} - Registrado por {provider.registrado_por || "sin registro"}
                    </p>
                  </div>

                  <div className="flex items-center justify-start md:justify-end">
                    <Button
                      type="button"
                      onClick={() => void validateProvider(provider)}
                      disabled={isValidating || provider.estado === "VALIDADO"}
                      className="h-10 rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isValidating ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Aprobar
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

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
            title: "Accesos y reservas",
            description: "Revise accesos activos y reservas vigentes en una sola pantalla.",
            path: "/residente/unificado",
          },
          {
            title: "Reglamentos",
            description: "Consulte reglas por categoria con buscador y detalle.",
            path: "/residente/reglamentos",
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
