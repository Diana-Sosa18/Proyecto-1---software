import { PackageCheck, Shield, UserCheck, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const visitors = [
  { nombre: "Carlos Rodríguez", destino: "Casa A-12", estado: "Esperando ingreso" },
  { nombre: "Paquetería Express", destino: "Torre B - 302", estado: "Entrega autorizada" },
  { nombre: "Ana Martínez", destino: "Casa C-04", estado: "Dentro del complejo" },
];

export function GuardiaView() {
  return (
    <AppShell
      role="guardia"
      title="Panel de Guardia"
      subtitle="Control de accesos, registro de visitas y operación del puesto de seguridad."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitas del turno" value="23" helper="5 pendientes de ingreso" icon={Users} />
        <StatCard label="Entregas rápidas" value="9" helper="2 por confirmar" icon={PackageCheck} />
        <StatCard label="Validaciones" value="100%" helper="Sin rechazos manuales" icon={UserCheck} />
        <StatCard label="Seguridad" value="Alta" helper="Monitoreo estable" icon={Shield} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Control de ingresos</CardTitle>
          <CardDescription>Listado operativo para revisión rápida desde garita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitors.map((visitor) => (
            <div
              key={`${visitor.nombre}-${visitor.destino}`}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-slate-900">{visitor.nombre}</p>
                <p className="text-sm text-slate-500">{visitor.destino}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                {visitor.estado}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
