import { ArrowRight, BarChart3, CalendarDays, CreditCard, KeyRound, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminView() {
  const navigate = useNavigate();

  return (
    <AppShell
      role="admin"
      title="Panel Administrativo"
      subtitle="Supervision operativa, accesos, cobranzas, comunicacion y gestion de usuarios."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accesos hoy" value="128" helper="+12% frente a ayer" icon={KeyRound} />
        <StatCard label="Pagos del mes" value="$48,200" helper="89% de recuperacion" icon={CreditCard} />
        <StatCard label="Comunicados activos" value="6" helper="2 pendientes de publicar" icon={Megaphone} />
        <StatCard label="Indicadores" value="94%" helper="Satisfaccion operativa" icon={BarChart3} />
      </div>

      <Card className="border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#eef2ff_100%)] shadow-[0_18px_42px_rgba(37,99,235,0.08)]">
        <CardContent className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-600 p-3 text-white">
              <CalendarDays className="size-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-950">Amenidades / Reservas</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                El modulo con el calendario, disponibilidad real, proximas reservas y acciones rapidas
                esta aqui.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => navigate("/admin/amenidades")}
            className="h-12 rounded-2xl bg-blue-600 px-6 text-white hover:bg-blue-700"
          >
            Abrir modulo
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen ejecutivo</CardTitle>
            <CardDescription>Estado general de los procesos clave de administracion.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Accesos", "Sin incidentes criticos en las ultimas 24 horas."],
              ["Cobranza", "10 cuentas con saldo pendiente para seguimiento."],
              ["Amenidades", "3 reservas confirmadas para este fin de semana."],
              ["Reportes", "2 tickets de mantenimiento priorizados por urgencia."],
            ].map(([title, text]) => (
              <button
                key={title}
                type="button"
                onClick={title === "Amenidades" ? () => navigate("/admin/amenidades") : undefined}
                className={`rounded-xl border border-slate-200 bg-slate-50 p-4 text-left ${
                  title === "Amenidades"
                    ? "transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                    : ""
                }`}
              >
                <h3 className="text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones recomendadas</CardTitle>
            <CardDescription>Tareas rapidas del turno administrativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Validar nuevos usuarios pendientes de activacion.",
              "Publicar comunicado sobre mantenimiento preventivo.",
              "Revisar los pagos vencidos de la semana.",
              "Confirmar disponibilidad del salon de eventos.",
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={
                  item === "Confirmar disponibilidad del salon de eventos."
                    ? () => navigate("/admin/amenidades")
                    : undefined
                }
                className={`w-full rounded-xl border border-slate-200 p-4 text-left text-sm text-slate-600 ${
                  item === "Confirmar disponibilidad del salon de eventos."
                    ? "transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                    : ""
                }`}
              >
                {item}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <UsersManagement />
    </AppShell>
  );
}
