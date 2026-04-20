import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAmenitiesReservationRequest,
  getAmenityAvailabilityRequest,
  getAmenitiesRequest,
  getAmenitiesReservationsRequest,
} from "@/services/amenitiesService";
import type { Amenity, AmenityAvailabilityResponse, AmenityReservation } from "@/types/amenities";

type SlotSelection = {
  hora_inicio: string;
  hora_fin: string;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function getWeekDates(baseDate: Date) {
  const current = new Date(baseDate);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(current);
    item.setDate(current.getDate() + index);
    return formatDate(item);
  });
}

export function ResidenteAmenitiesView() {
  const navigate = useNavigate();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [reservations, setReservations] = useState<AmenityReservation[]>([]);
  const [availability, setAvailability] = useState<AmenityAvailabilityResponse | null>(null);
  const [selectedAmenityId, setSelectedAmenityId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null);
  const [weekReference, setWeekReference] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const weekDates = useMemo(() => getWeekDates(weekReference), [weekReference]);

  useEffect(() => {
    if (!selectedDate && weekDates.length > 0) {
      setSelectedDate(weekDates[0]);
    }
  }, [selectedDate, weekDates]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const [amenitiesResponse, reservationsResponse] = await Promise.all([
          getAmenitiesRequest(),
          getAmenitiesReservationsRequest({
            from: weekDates[0],
            to: weekDates[6],
          }),
        ]);

        if (!active) {
          return;
        }

        setAmenities(amenitiesResponse);
        setReservations(reservationsResponse);
        if (amenitiesResponse.length > 0) {
          setSelectedAmenityId((current) => current ?? amenitiesResponse[0].id_amenidad);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "No fue posible cargar las amenidades.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [weekDates]);

  useEffect(() => {
    if (!selectedAmenityId || !selectedDate) {
      return;
    }

    let active = true;

    async function loadAvailability() {
      try {
        setIsLoadingAvailability(true);
        const response = await getAmenityAvailabilityRequest(selectedAmenityId, selectedDate);

        if (active) {
          setAvailability(response);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "No fue posible cargar la disponibilidad.",
          );
          setAvailability(null);
        }
      } finally {
        if (active) {
          setIsLoadingAvailability(false);
        }
      }
    }

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [selectedAmenityId, selectedDate]);

  const selectedAmenity = useMemo(
    () => amenities.find((item) => item.id_amenidad === selectedAmenityId) || null,
    [amenities, selectedAmenityId],
  );

  const selectedReservations = useMemo(() => {
    if (availability?.fecha === selectedDate && availability.amenidad.id_amenidad === selectedAmenityId) {
      return availability.reservas;
    }

    if (!selectedAmenityId || !selectedDate) {
      return [];
    }

    return reservations.filter(
      (item) => item.id_amenidad === selectedAmenityId && item.fecha === selectedDate,
    );
  }, [availability, reservations, selectedAmenityId, selectedDate]);

  const selectedSlotIsBusy = useMemo(() => {
    if (!selectedSlot) {
      return true;
    }

    const slot = availability?.slots.find(
      (item) =>
        item.hora_inicio === selectedSlot.hora_inicio && item.hora_fin === selectedSlot.hora_fin,
    );

    return !slot || !slot.disponible;
  }, [availability, selectedSlot]);

  async function handleConfirmReservation() {
    if (!selectedAmenityId || !selectedDate || !selectedSlot) {
      setErrorMessage("Selecciona amenidad, dia y horario antes de confirmar.");
      return;
    }

    if (selectedSlotIsBusy) {
      setErrorMessage("Ese horario ya no esta disponible.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      const created = await createAmenitiesReservationRequest({
        id_amenidad: selectedAmenityId,
        fecha: selectedDate,
        hora_inicio: selectedSlot.hora_inicio,
        hora_fin: selectedSlot.hora_fin,
      });

      setReservations((current) => [...current, created]);
      const nextAvailability = await getAmenityAvailabilityRequest(selectedAmenityId, selectedDate);
      setAvailability(nextAvailability);
      setSuccessMessage(
        `Reserva confirmada para ${created.amenidad_nombre} el ${formatLongDate(created.fecha)} a las ${created.hora_inicio}.`,
      );
      setSelectedSlot(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible confirmar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      role="residente"
      title="Panel de Residente"
      subtitle="Visitas, amenidades, avisos y operacion diaria de su unidad residencial."
    >
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/residente")}
          className="inline-flex items-center gap-3 text-left text-slate-700 transition hover:text-slate-950"
        >
          <ArrowLeft className="size-5" />
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Reservar amenidades</h2>
            <p className="text-sm text-slate-600">Disponibilidad real y confirmacion inmediata</p>
          </div>
        </button>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <AlertTitle>Reserva confirmada</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-white/70 bg-white shadow-[0_16px_40px_rgba(30,41,59,0.08)]">
          <CardHeader>
            <CardTitle className="text-xl">Amenidades disponibles</CardTitle>
            <CardDescription>
              Selecciona la amenidad y consulta solo horarios almacenados en la base de datos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Cargando amenidades...
              </div>
            ) : amenities.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No hay amenidades configuradas.
              </div>
            ) : (
              amenities.map((amenity) => (
                <button
                  key={amenity.id_amenidad}
                  type="button"
                  onClick={() => {
                    setSelectedAmenityId(amenity.id_amenidad);
                    setSelectedSlot(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
                    amenity.id_amenidad === selectedAmenityId
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="size-5 text-blue-600" />
                    <div>
                      <span className="font-medium text-slate-900">{amenity.nombre}</span>
                      <p className="mt-1 text-xs text-slate-500">
                        {amenity.hora_apertura} - {amenity.hora_cierre}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-slate-500">
                    {amenity.activo ? "Ver horarios" : "Inactiva"}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white shadow-[0_16px_40px_rgba(30,41,59,0.08)]">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Calendario semanal</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const previous = new Date(weekReference);
                    previous.setDate(previous.getDate() - 7);
                    setWeekReference(previous);
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const next = new Date(weekReference);
                    next.setDate(next.getDate() + 7);
                    setWeekReference(next);
                  }}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Cambia el dia para consultar la disponibilidad real de la amenidad seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {weekDates.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setSelectedDate(day);
                  setSelectedSlot(null);
                }}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  selectedDate === day
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                }`}
              >
                <p className="text-xs uppercase">
                  {new Date(`${day}T00:00:00`).toLocaleDateString("es-GT", { weekday: "short" })}
                </p>
                <p className="text-sm font-semibold">{formatLongDate(day)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {reservations.filter((item) => item.fecha === day).length} reserva(s)
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white shadow-[0_16px_40px_rgba(30,41,59,0.08)]">
          <CardHeader>
            <CardTitle className="text-xl">Cuadricula de horarios</CardTitle>
            <CardDescription>
              {selectedAmenity ? `${selectedAmenity.nombre} | ${formatLongDate(selectedDate)}` : "Selecciona una amenidad"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingAvailability ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Cargando disponibilidad...
              </div>
            ) : availability && availability.slots.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {availability.slots.map((slot) => {
                  const isSelected =
                    selectedSlot?.hora_inicio === slot.hora_inicio &&
                    selectedSlot?.hora_fin === slot.hora_fin;

                  return (
                    <button
                      key={`${slot.hora_inicio}-${slot.hora_fin}`}
                      type="button"
                      disabled={!slot.disponible || !selectedAmenity}
                      onClick={() =>
                        setSelectedSlot({
                          hora_inicio: slot.hora_inicio,
                          hora_fin: slot.hora_fin,
                        })
                      }
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        !slot.disponible
                          ? "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-700"
                          : isSelected
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Clock3 className="size-4" />
                        {slot.hora_inicio} - {slot.hora_fin}
                      </p>
                      <p className="mt-1 text-xs">
                        {slot.disponible ? "Disponible" : "Ocupado"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No hay bloques configurados para esta amenidad en la fecha seleccionada.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Reservas del dia</p>
              <div className="mt-3 space-y-2">
                {selectedReservations.length > 0 ? (
                  selectedReservations.map((reservation) => (
                    <div
                      key={reservation.reservation_key}
                      className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
                    >
                      <span>
                        {reservation.hora_inicio} - {reservation.hora_fin}
                      </span>
                      <span className="text-xs text-slate-500">{reservation.estado_actual}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">Sin reservas para este dia.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!selectedAmenity || !selectedDate || !selectedSlot || selectedSlotIsBusy || isSubmitting}
            onClick={handleConfirmReservation}
            className="h-12 rounded-2xl bg-[linear-gradient(90deg,#3b82f6_0%,#1d4ed8_100%)] px-8 text-white hover:opacity-95"
          >
            {isSubmitting ? "Confirmando..." : "Confirmar reserva"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
