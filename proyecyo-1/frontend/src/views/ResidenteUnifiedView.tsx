import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAmenitiesReservationsRequest } from "@/services/amenitiesService";
import { getVisitsRequest } from "@/services/visitsService";
import type { AmenityReservation } from "@/types/amenities";
import type { VisitRecord } from "@/types/visits";

type UnifiedFilter = "TODOS" | "ACCESOS" | "RESERVAS" | "ACTIVOS";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ResidenteUnifiedView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [reservations, setReservations] = useState<AmenityReservation[]>([]);
  const [filter, setFilter] = useState<UnifiedFilter>("TODOS");

  useEffect(() => {
    let active = true;

    Promise.all([
      getVisitsRequest(),
      getAmenitiesReservationsRequest({
        from: today(),
        to: futureDate(30),
        id_usuario: user?.id,
      }),
    ])
      .then(([visitsResponse, reservationsResponse]) => {
        if (active) {
          setVisits(visitsResponse);
          setReservations(reservationsResponse);
        }
      })
      .catch(() => {
        if (active) {
          setVisits([]);
          setReservations([]);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const items = useMemo(() => {
    const accessItems = visits.map((visit) => ({
      id: `access-${visit.id_acceso}`,
      type: "ACCESOS" as const,
      title: visit.nombre,
      subtitle: `${visit.casa} | ${visit.fecha} | ${visit.hora_inicio} - ${visit.hora_fin}`,
      status: visit.estado_acceso === "INGRESO_REGISTRADO" ? "Utilizado" : visit.estado_acceso === "CANCELADA" ? "Cancelado" : "Activo",
      active: visit.estado_acceso === "AUTORIZADA",
    }));
    const reservationItems = reservations.map((reservation) => ({
      id: `reservation-${reservation.reservation_key}`,
      type: "RESERVAS" as const,
      title: reservation.amenidad_nombre,
      subtitle: `${reservation.fecha} | ${reservation.hora_inicio} - ${reservation.hora_fin}`,
      status: reservation.estado_actual,
      active: ["CONFIRMADA", "PENDIENTE", "EN_CURSO"].includes(reservation.estado_actual),
    }));

    return [...accessItems, ...reservationItems]
      .filter((item) => filter === "TODOS" || item.type === filter || (filter === "ACTIVOS" && item.active))
      .sort((first, second) => second.subtitle.localeCompare(first.subtitle));
  }, [filter, reservations, visits]);

  return (
    <AppShell role="residente" title="Panel de Residente" subtitle="Accesos y reservas en una sola pantalla.">
      <button
        type="button"
        onClick={() => navigate("/residente")}
        className="inline-flex items-center gap-3 text-left text-slate-700 transition hover:text-slate-950"
      >
        <ArrowLeft className="size-5" />
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Accesos y reservas</h2>
          <p className="text-sm text-slate-600">Vista unificada con estados visuales y filtros rapidos</p>
        </div>
      </button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Resumen unificado</CardTitle>
              <CardDescription>Datos reales de accesos y reservas activas.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["TODOS", "ACTIVOS", "ACCESOS", "RESERVAS"] as UnifiedFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    filter === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              No hay datos para el filtro seleccionado.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      {item.type === "ACCESOS" ? <KeyRound className="size-5" /> : <CalendarDays className="size-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {item.status}
                  </span>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
