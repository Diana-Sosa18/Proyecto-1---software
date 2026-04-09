import { BarChart3, CreditCard, KeyRound, Megaphone } from "lucide-react";

import { UsersManagement } from "@/components/admin/UsersManagement";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminView() {
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
            <CardDescription>Tareas rapidas del turno administrativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Validar nuevos usuarios pendientes de activacion.",
              "Publicar comunicado sobre mantenimiento preventivo.",
              "Revisar los pagos vencidos de la semana.",
              "Confirmar disponibilidad del salon de eventos.",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <UsersManagement />
    </AppShell>
  );
}
