import { AlertCircle, CreditCard, FileText, UserCheck } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InquilinoView() {
  return (
    <AppShell
      role="inquilino"
      title="Panel de Inquilino"
      subtitle="Accesos autorizados, reportes, permisos y solicitudes pendientes del inmueble."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accesos activos" value="3" helper="1 recurrente y 2 temporales" icon={UserCheck} />
        <StatCard label="Solicitudes" value="5" helper="2 en aprobación" icon={FileText} />
        <StatCard label="Reportes" value="2" helper="1 en proceso" icon={AlertCircle} />
        <StatCard label="Pagos" value="Al día" helper="Sin saldo pendiente" icon={CreditCard} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Centro de gestión del inquilino</CardTitle>
          <CardDescription>Resumen rápido de acciones frecuentes y estado actual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            "Autorizar visitas y deliveries para su unidad.",
            "Solicitar permisos que requieren aprobación del propietario.",
            "Levantar tickets o reportes de mantenimiento.",
            "Consultar sus solicitudes pendientes y el historial reciente.",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}