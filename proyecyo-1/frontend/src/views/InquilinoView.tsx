import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundPlus,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QrCodeCard } from "@/components/visits/QrCodeCard";
import {
  createVisitRequest,
  deleteVisitRequest,
  getFrequentVisitorsRequest,
  getVisitsRequest,
} from "@/services/visitsService";
import type { FrequentVisitor, VisitPayload, VisitRecord, VisitType } from "@/types/visits";

type VisitFormState = VisitPayload;
type AccessFilter = "TODOS" | "APROBADO" | "UTILIZADO" | "RECHAZADO" | "PENDIENTE";

const RESIDENTIAL_TIMEZONE = "America/Guatemala";

const steps = [
  { id: 1, label: "Datos del Visitante", description: "Informacion basica de identificacion" },
  { id: 2, label: "Horario y Acceso", description: "Define fecha, horario y tipo de visita" },
  { id: 3, label: "Confirmacion", description: "Revisa la informacion antes de autorizar" },
];

const visitTypeLabels: Record<VisitType, string> = {
  VISITA: "Visita personal",
  DELIVERY: "Delivery",
  PROVEEDOR: "Proveedor",
};

const statusLabels: Record<AccessFilter, string> = {
  TODOS: "Todos",
  APROBADO: "Aprobado",
  PENDIENTE: "Pendiente",
  RECHAZADO: "Rechazado",
  UTILIZADO: "Utilizado",
};

const statusStyles: Record<Exclude<AccessFilter, "TODOS">, string> = {
  APROBADO: "bg-emerald-50 text-emerald-700",
  PENDIENTE: "bg-amber-50 text-amber-700",
  RECHAZADO: "bg-rose-50 text-rose-700",
  UTILIZADO: "bg-blue-50 text-blue-700",
};

function getDateInTimezone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESIDENTIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTimeInTimezone(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: RESIDENTIAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function createInitialForm(): VisitFormState {
  const now = new Date();
  const finish = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return {
    nombre: "",
    dpi: "",
    placa: "",
    foto: "",
    fecha: getDateInTimezone(now),
    hora_inicio: getTimeInTimezone(now),
    hora_fin: getTimeInTimezone(finish),
    tipo_visita: "VISITA",
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getAccessStatus(visit: VisitRecord): Exclude<AccessFilter, "TODOS"> {
  if (visit.estado_acceso === "INGRESO_REGISTRADO" || visit.qr_status === "USED") {
    return "UTILIZADO";
  }

  if (visit.estado_acceso === "CANCELADA" || visit.qr_status === "CANCELLED") {
    return "RECHAZADO";
  }

  return "APROBADO";
}

function countTodayVisits(visits: VisitRecord[]) {
  const today = getDateInTimezone(new Date());
  return visits.filter((visit) => visit.fecha === today).length;
}

export function InquilinoView() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<VisitFormState>(createInitialForm);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [frequentVisitors, setFrequentVisitors] = useState<FrequentVisitor[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<AccessFilter>("TODOS");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authorizingVisitorId, setAuthorizingVisitorId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const [visitsResult, frequentResult] = await Promise.allSettled([
          getVisitsRequest(),
          getFrequentVisitorsRequest(),
        ]);

        if (!active) {
          return;
        }

        if (visitsResult.status === "fulfilled") {
          setVisits(visitsResult.value);
        } else {
          setErrorMessage(
            visitsResult.reason instanceof Error
              ? visitsResult.reason.message
              : "No fue posible cargar los accesos.",
          );
        }

        setFrequentVisitors(frequentResult.status === "fulfilled" ? frequentResult.value : []);
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
  }, []);

  const todayVisits = useMemo(() => countTodayVisits(visits), [visits]);
  const usedCount = useMemo(
    () => visits.filter((visit) => getAccessStatus(visit) === "UTILIZADO").length,
    [visits],
  );
  const activeCount = useMemo(
    () => visits.filter((visit) => getAccessStatus(visit) === "APROBADO").length,
    [visits],
  );
  const filteredVisits = useMemo(
    () =>
      selectedStatus === "TODOS"
        ? visits
        : visits.filter((visit) => getAccessStatus(visit) === selectedStatus),
    [selectedStatus, visits],
  );

  function updateForm<K extends keyof VisitFormState>(field: K, value: VisitFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateStep() {
    if (step === 1 && !form.nombre.trim()) {
      setErrorMessage("El nombre del visitante es obligatorio.");
      return false;
    }

    if (step === 2) {
      if (!form.fecha || !form.hora_inicio || !form.hora_fin) {
        setErrorMessage("Completa fecha y horario antes de continuar.");
        return false;
      }

      if (form.hora_inicio >= form.hora_fin) {
        setErrorMessage("La hora de fin debe ser mayor a la hora de inicio.");
        return false;
      }
    }

    setErrorMessage("");
    return true;
  }

  function handleNext() {
    if (!validateStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length));
  }

  function handlePrevious() {
    setErrorMessage("");
    setStep((current) => Math.max(current - 1, 1));
  }

  async function refreshFrequentVisitors() {
    try {
      setFrequentVisitors(await getFrequentVisitorsRequest());
    } catch {
      setFrequentVisitors([]);
    }
  }

  async function createVisit(payload: VisitPayload, message: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const createdVisit = await createVisitRequest({
        ...payload,
        foto: null,
      });
      setVisits((current) => [createdVisit, ...current]);
      setSuccessMessage(message);
      setSelectedStatus("TODOS");
      setForm(createInitialForm());
      setStep(1);
      await refreshFrequentVisitors();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible autorizar la visita.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (step < steps.length) {
      handleNext();
      return;
    }

    await createVisit(form, "Visita autorizada correctamente. El QR ya esta disponible.");
  }

  async function handleQuickAuthorize(visitor: FrequentVisitor) {
    setAuthorizingVisitorId(visitor.id_visitante);
    const now = new Date();
    const finish = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await createVisit(
      {
        nombre: visitor.nombre,
        dpi: visitor.dpi,
        placa: visitor.placa,
        foto: "",
        fecha: getDateInTimezone(now),
        hora_inicio: getTimeInTimezone(now),
        hora_fin: getTimeInTimezone(finish),
        tipo_visita: "VISITA",
      },
      `Visita rapida autorizada para ${visitor.nombre}.`,
    );
    setAuthorizingVisitorId(null);
  }

  async function handleDelete(visit: VisitRecord) {
    const confirmed = window.confirm(`Deseas eliminar la visita autorizada de ${visit.nombre}?`);

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      await deleteVisitRequest(visit.id_acceso);
      setVisits((current) => current.filter((item) => item.id_acceso !== visit.id_acceso));
      setSuccessMessage("Visita eliminada correctamente.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible eliminar la visita.");
    }
  }

  return (
    <AppShell
      role="inquilino"
      title="Panel de Inquilino"
      subtitle="Autoriza visitas y da seguimiento a los accesos asociados a tu unidad."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accesos activos"
          value={String(activeCount)}
          helper="Visitas autorizadas pendientes de ingreso"
          icon={UserCheck}
        />
        <StatCard
          label="Autorizadas hoy"
          value={String(todayVisits)}
          helper="Creadas para la fecha actual"
          icon={CalendarClock}
        />
        <StatCard
          label="Utilizados"
          value={String(usedCount)}
          helper="QR escaneados por garita"
          icon={ShieldCheck}
        />
        <StatCard
          label="Estado de cuenta"
          value="Al dia"
          helper="Sin bloqueos por pagos pendientes"
          icon={CreditCard}
        />
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <AlertTitle>Operacion exitosa</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-0 shadow-[0_18px_40px_rgba(30,41,59,0.12)]">
        <div className="bg-[linear-gradient(90deg,#a855f7_0%,#9333ea_45%,#9d00ff_100%)] px-5 py-6 text-white">
          <div className="flex items-center gap-3">
            <Zap className="size-5" />
            <h3 className="text-2xl font-semibold">Acceso Rapido</h3>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">1 click</span>
          </div>
          <p className="mt-3 text-lg text-white/95">
            Autoriza visitantes frecuentes igual que en la vista de residente.
          </p>
        </div>
        <CardContent className="space-y-4 bg-white px-5 py-5">
          {isLoading ? (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
              Cargando visitantes frecuentes...
            </div>
          ) : frequentVisitors.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
              Aun no tienes visitantes frecuentes registrados.
            </div>
          ) : (
            frequentVisitors.map((visitor) => (
              <div
                key={visitor.id_visitante}
                className="flex flex-col gap-4 rounded-3xl bg-slate-50 px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-xl font-semibold text-slate-900">{visitor.nombre}</p>
                  <p className="text-sm text-slate-500">
                    {visitor.placa || "Sin placa"} {visitor.dpi ? `DPI: ${visitor.dpi}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {visitor.total_visitas} visita{visitor.total_visitas !== 1 ? "s" : ""}
                    {visitor.ultima_fecha ? ` | Ultima: ${formatDate(visitor.ultima_fecha)}` : ""}
                  </p>
                </div>
                <Button
                  onClick={() => handleQuickAuthorize(visitor)}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-[linear-gradient(90deg,#a855f7_0%,#8b2cf5_100%)] px-6 text-base text-white hover:opacity-95"
                >
                  {authorizingVisitorId === visitor.id_visitante ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Autorizando...
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Autorizar
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          {steps.map((item) => (
            <span
              key={item.id}
              className={`h-3 rounded-full transition-all ${
                item.id === step ? "w-10 bg-blue-500" : "w-3 bg-slate-300"
              }`}
            />
          ))}
        </div>
        <p className="text-lg text-slate-700">Paso {step} de 3</p>
      </div>

      <Card className="border-white/70 bg-white shadow-[0_16px_40px_rgba(30,41,59,0.08)]">
        <CardHeader className="gap-2">
          <div className="flex items-start gap-3">
            <UserRoundPlus className="mt-1 size-6 text-blue-600" />
            <div>
              <CardTitle className="text-2xl font-semibold text-slate-900">
                {steps[step - 1].label}
              </CardTitle>
              <p className="text-sm text-slate-600">{steps[step - 1].description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Nombre Completo *</span>
                <Input
                  value={form.nombre}
                  onChange={(event) => updateForm("nombre", event.target.value)}
                  placeholder="Ej. Juan Perez Garcia"
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">DPI / Documento (Opcional)</span>
                <Input
                  value={form.dpi}
                  onChange={(event) => updateForm("dpi", event.target.value)}
                  placeholder="1234567890123"
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Placa del Vehiculo (Opcional)</span>
                <Input
                  value={form.placa}
                  onChange={(event) => updateForm("placa", event.target.value.toUpperCase())}
                  placeholder="P-123ABC"
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                La fecha y hora se completaron automaticamente con la hora actual.
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-800">Fecha de visita *</span>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(event) => updateForm("fecha", event.target.value)}
                    className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-800">Tipo de visita *</span>
                  <select
                    value={form.tipo_visita}
                    onChange={(event) => updateForm("tipo_visita", event.target.value as VisitType)}
                    className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm outline-none focus:border-blue-300"
                  >
                    <option value="VISITA">Visita personal</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="PROVEEDOR">Proveedor</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-800">Hora de inicio *</span>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(event) => updateForm("hora_inicio", event.target.value)}
                    className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-800">Hora de fin *</span>
                  <Input
                    type="time"
                    value={form.hora_fin}
                    onChange={(event) => updateForm("hora_fin", event.target.value)}
                    className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4"
                  />
                </label>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Visitante", value: form.nombre || "No definido" },
                { label: "DPI", value: form.dpi || "No definido" },
                { label: "Placa", value: form.placa || "No definida" },
                { label: "Fecha", value: form.fecha ? formatDate(form.fecha) : "No definida" },
                { label: "Hora", value: `${form.hora_inicio || "--:--"} - ${form.hora_fin || "--:--"}` },
                { label: "Tipo", value: visitTypeLabels[form.tipo_visita] },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={step === 1 || isSubmitting}
          className="h-14 rounded-2xl border-slate-200 bg-slate-50 text-xl text-slate-600"
        >
          <ChevronLeft className="size-5" />
          Anterior
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-14 rounded-2xl bg-[linear-gradient(90deg,#3b82f6_0%,#1d4ed8_100%)] text-xl text-white hover:opacity-95"
        >
          {step === steps.length ? "Autorizar Visita" : "Siguiente"}
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <Card className="overflow-hidden border-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">Gestion de accesos</CardTitle>
              <CardDescription className="mt-2 text-sm text-slate-600">
                Accesos autorizados por el inquilino autenticado y compatibles con garita.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as AccessFilter[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedStatus === status
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
              Cargando accesos del inquilino...
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
              No hay accesos para el filtro seleccionado.
            </div>
          ) : (
            filteredVisits.map((visit) => {
              const accessStatus = getAccessStatus(visit);

              return (
                <article
                  key={visit.id_acceso}
                  className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm"
                >
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                          <KeyRound className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">{visit.nombre}</h3>
                          <p className="text-sm text-slate-500">{visitTypeLabels[visit.tipo_visita]}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[accessStatus]}`}>
                          {statusLabels[accessStatus]}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(visit)}
                          className="ml-auto rounded-full p-2 text-rose-500 transition hover:bg-rose-50"
                          aria-label={`Eliminar visita de ${visit.nombre}`}
                        >
                          <Trash2 className="size-5" />
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tipo</p>
                          <p className="mt-2 text-sm font-medium text-slate-800">{visitTypeLabels[visit.tipo_visita]}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fecha</p>
                          <p className="mt-2 text-sm font-medium text-slate-800">{formatDate(visit.fecha)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Hora</p>
                          <p className="mt-2 text-sm font-medium text-slate-800">
                            {visit.hora_inicio} - {visit.hora_fin}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Placa</p>
                          <p className="mt-2 text-sm font-medium text-slate-800">{visit.placa || "Sin placa"}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <CalendarDays className="size-4" />
                          Casa/unidad: {visit.casa || "Asignada al inquilino"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Referencia QR: {visit.token_qr || "Sin token disponible"}
                        </p>
                      </div>
                    </div>

                    {visit.qr_value ? (
                      <QrCodeCard
                        value={visit.qr_value}
                        title={`QR ${visit.nombre}`}
                        description={`Casa ${visit.casa} | ${visit.fecha} | ${visit.hora_inicio}`}
                      />
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
