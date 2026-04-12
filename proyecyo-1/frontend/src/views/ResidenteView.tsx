import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Home, UserRoundCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVisitsRequest } from "@/services/visitsService";
import type { VisitRecord } from "@/types/visits";

export function ResidenteView() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitRecord[]>([]);

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

    return () => {
      active = false;
    };
  }, []);

  const todayVisits = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visits.filter((visit) => visit.fecha === today).length;
  }, [visits]);

  return (
    <AppShell
      role="residente"
      title="Panel de Residente"
      subtitle="Visitas, amenidades, avisos y operacion diaria de su unidad residencial."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visitas autorizadas"
          value={String(visits.length)}
          helper={`${todayVisits} programadas para hoy`}
          icon={UserRoundCheck}
          onClick={() => navigate("/residente/visitas")}
        />
        <StatCard label="Reservas" value="2" helper="Salon y cancha activos" icon={CalendarDays} />
        <StatCard label="Avisos" value="3" helper="1 comunicado importante" icon={Bell} />
        <StatCard label="Unidad" value="B-302" helper="Estado al dia" icon={Home} />
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
          <Card
            key={section.title}
            className={section.title === "Visitas" ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""}
            onClick={section.title === "Visitas" ? () => navigate("/residente/visitas") : undefined}
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
