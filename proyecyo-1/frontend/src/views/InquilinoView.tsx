import {
  BadgeCheck,
  CalendarClock,
  CarFront,
  Clock3,
  CreditCard,
  FileText,
  KeyRound,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthorizedAccess = {
  id: number;
  visitorName: string;
  category: "Visita personal" | "Delivery" | "Proveedor" | "Familiar frecuente";
  accessType: "Temporal" | "Recurrente";
  dateLabel: string;
  timeRange: string;
  hostApproval: string;
  status: "Activo" | "Por vencer" | "Programado";
  vehicle: string;
  notes: string;
};

const authorizedAccesses: AuthorizedAccess[] = [
  {
    id: 1,
    visitorName: "Mariana Castillo",
    category: "Familiar frecuente",
    accessType: "Recurrente",
    dateLabel: "Lunes a viernes",
    timeRange: "07:00 - 19:00",
    hostApproval: "Autorizado por propietario y administracion",
    status: "Activo",
    vehicle: "P-481KTR",
    notes: "Ingreso habilitado para apoyo domestico durante la semana.",
  },
  {
    id: 2,
    visitorName: "QuickBox Mensajeria",
    category: "Delivery",
    accessType: "Temporal",
    dateLabel: "Hoy, 17 de abril",
    timeRange: "14:00 - 16:00",
    hostApproval: "Autorizado por inquilino",
    status: "Por vencer",
    vehicle: "Moto sin registro",
    notes: "Entrega de documentos y paquete pequeno en recepcion.",
  },
  {
    id: 3,
    visitorName: "Tecnored Servicios",
    category: "Proveedor",
    accessType: "Temporal",
    dateLabel: "Sabado, 19 de abril",
    timeRange: "09:30 - 12:00",
    hostApproval: "Pendiente de control en garita",
    status: "Programado",
    vehicle: "C-209BFR",
    notes: "Mantenimiento preventivo del servicio de internet.",
  },
];

const statusStyles: Record<AuthorizedAccess["status"], string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  "Por vencer": "bg-amber-50 text-amber-700",
  Programado: "bg-blue-50 text-blue-700",
};

export function InquilinoView() {
  const activeCount = authorizedAccesses.filter((access) => access.status === "Activo").length;
  const expiringCount = authorizedAccesses.filter((access) => access.status === "Por vencer").length;
  const scheduledCount = authorizedAccesses.filter((access) => access.status === "Programado").length;
  const recurringCount = authorizedAccesses.filter((access) => access.accessType === "Recurrente").length;

  return (
    <AppShell
      role="inquilino"
      title="Panel de Inquilino"
      subtitle="Consulta, controla y da seguimiento a los accesos autorizados asociados a tu unidad."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accesos activos"
          value={String(activeCount)}
          helper={`${recurringCount} recurrente y ${activeCount - recurringCount} temporal`}
          icon={UserCheck}
        />
        <StatCard
          label="Por vencer"
          value={String(expiringCount)}
          helper="Requieren renovacion o cierre durante el dia"
          icon={Clock3}
        />
        <StatCard
          label="Programados"
          value={String(scheduledCount)}
          helper="Autorizaciones futuras ya registradas"
          icon={CalendarClock}
        />
        <StatCard
          label="Estado de cuenta"
          value="Al dia"
          helper="Sin bloqueos por pagos pendientes"
          icon={CreditCard}
        />
      </div>

      <Card className="overflow-hidden border-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">Accesos autorizados</CardTitle>
              <CardDescription className="mt-2 text-sm text-slate-600">
                Visualiza quienes tienen ingreso aprobado, su vigencia y las condiciones de acceso.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <ShieldCheck className="size-4" />
              Control centralizado para garita y recepcion
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {authorizedAccesses.map((access) => (
            <article
              key={access.id}
              className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{access.visitorName}</h3>
                      <p className="text-sm text-slate-500">{access.category}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[access.status]}`}
                    >
                      {access.status}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tipo</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{access.accessType}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fecha</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{access.dateLabel}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Horario</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{access.timeRange}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Vehiculo</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{access.vehicle}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">{access.hostApproval}</p>
                    <p className="mt-1 text-sm text-slate-500">{access.notes}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[250px] xl:grid-cols-1">
                  <div className="rounded-2xl bg-slate-900 p-4 text-white">
                    <BadgeCheck className="size-5 text-blue-300" />
                    <p className="mt-3 text-sm text-slate-300">Validacion</p>
                    <p className="mt-1 text-lg">Habilitada</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                    <UsersRound className="size-5" />
                    <p className="mt-3 text-sm">Seguimiento</p>
                    <p className="mt-1 text-lg">Garita informada</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4 text-amber-800">
                    <CarFront className="size-5" />
                    <p className="mt-3 text-sm">Observacion</p>
                    <p className="mt-1 text-lg">
                      {access.vehicle === "Moto sin registro" ? "Sin placa fija" : "Vehiculo registrado"}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="border-slate-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">Politicas de autorizacion</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Reglas que el inquilino debe considerar para mantener accesos vigentes y sin bloqueos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              "Los accesos temporales vencen automaticamente al finalizar el horario autorizado.",
              "Los accesos recurrentes deben estar respaldados por una autorizacion vigente del propietario.",
              "Cualquier cambio en vehiculo, visitante o proveedor debe reflejarse antes del ingreso.",
              "Si existe un saldo bloqueado o una observacion administrativa, la garita puede restringir el acceso.",
            ].map((policy) => (
              <div key={policy} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {policy}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)]">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">Acciones relacionadas</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Siguientes pasos sugeridos para la gestion del acceso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                icon: FileText,
                title: "Solicitar nueva autorizacion",
                description: "Registra un acceso nuevo para visitas, deliveries o proveedores.",
              },
              {
                icon: ShieldCheck,
                title: "Renovar acceso recurrente",
                description: "Extiende permisos frecuentes que estan proximos a vencer.",
              },
              {
                icon: Clock3,
                title: "Revisar vencimientos",
                description: "Verifica accesos del dia para evitar rechazos en garita.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
