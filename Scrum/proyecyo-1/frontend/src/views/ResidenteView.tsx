import { Bell, CalendarDays, Home, UserRoundCheck } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResidenteView() {
  return (
    <AppShell
      role="residente"
      title="Panel de Residente"
      subtitle="Visitas, amenidades, avisos y operación diaria de su unidad residencial."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitas autorizadas" value="4" helper="2 programadas para hoy" icon={UserRoundCheck} />
        <StatCard label="Reservas" value="2" helper="Salón y cancha activos" icon={CalendarDays} />
        <StatCard label="Avisos" value="3" helper="1 comunicado importante" icon={Bell} />
        <StatCard label="Unidad" value="B-302" helper="Estado al día" icon={Home} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Visitas",
            description: "Autorice ingresos temporales, recurrentes o permanentes.",
          },
          {
            title: "Amenidades",
            description: "Consulte disponibilidad y confirme sus reservas.",
          },
          {
            title: "Comunidad",
            description: "Revise avisos, mantenimientos y novedades del residencial.",
          },
        ].map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Módulo listo para conectar con sus datos reales desde la API.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}