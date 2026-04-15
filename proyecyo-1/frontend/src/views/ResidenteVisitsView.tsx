import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrCodeCard } from "@/components/visits/QrCodeCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createVisitRequest,
  deleteFrequentVisitorRequest,
  deleteVisitRequest,
  getFrequentVisitorsRequest,
  getVisitsRequest,
} from "@/services/visitsService";
import type { FrequentVisitor, VisitPayload, VisitRecord, VisitType } from "@/types/visits";

type VisitFormState = VisitPayload;
const RESIDENTIAL_TIMEZONE = "America/Guatemala";

const steps = [
  { id: 1, label: "Datos del Visitante", description: "Informacion basica de identificacion" },
  { id: 2, label: "Horario y Acceso", description: "Define fecha, horario y tipo de visita" },
  { id: 3, label: "Confirmacion", description: "Revisa la informacion antes de autorizar" },
];

const visitTypeLabels: Record<VisitType, string> = {
  VISITA: "personal",
  DELIVERY: "delivery",
  PROVEEDOR: "proveedor",
};

function createInitialForm(): VisitFormState {
  const now = new Date();
  const finish = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const currentDate = getDateInTimezone(now);
  const startTime = getTimeInTimezone(now);
  const finishTime = getTimeInTimezone(finish);

  return {
    nombre: "",
    dpi: "",
    placa: "",
    foto: "",
    fecha: currentDate,
    hora_inicio: startTime,
    hora_fin: finishTime,
    tipo_visita: "VISITA",
  };
}

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function countTodayVisits(visits: VisitRecord[]) {
  const today = getDateInTimezone(new Date());
  return visits.filter((visit) => visit.fecha === today).length;
}

export function ResidenteVisitsView() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<VisitFormState>(createInitialForm);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [frequentVisitors, setFrequentVisitors] = useState<FrequentVisitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [authorizingVisitorId, setAuthorizingVisitorId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setIsLoading(true);
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
              : "No fue posible cargar las visitas.",
          );
        }

        if (frequentResult.status === "fulfilled") {
          setFrequentVisitors(frequentResult.value);
        } else {
          setFrequentVisitors([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const todayVisits = useMemo(() => countTodayVisits(visits), [visits]);

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
      const data = await getFrequentVisitorsRequest();
      setFrequentVisitors(data);
    } catch {
      // La visita ya fue creada; si esta recarga secundaria falla no bloqueamos el flujo.
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
      setForm(createInitialForm());
      setPhotoPreview("");
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

    await createVisit(form, "Visita autorizada correctamente.");
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

  async function handleDeleteFrequentVisitor(visitor: FrequentVisitor) {
    const confirmed = window.confirm(
      `Deseas eliminar a ${visitor.nombre} de tus visitantes frecuentes? Se eliminaran todas sus visitas asociadas.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      await deleteFrequentVisitorRequest(visitor.id_visitante);
      setFrequentVisitors((current) =>
        current.filter((item) => item.id_visitante !== visitor.id_visitante),
      );
      setVisits((current) =>
        current.filter((item) => item.id_visitante !== visitor.id_visitante),
      );
      setSuccessMessage(`Visitante frecuente ${visitor.nombre} eliminado correctamente.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible eliminar el visitante frecuente.",
      );
    }
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoPreview("");
      updateForm("foto", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecciona un archivo de imagen valido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const preview = typeof reader.result === "string" ? reader.result : "";
      setPhotoPreview(preview);
      updateForm("foto", file.name);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setPhotoPreview("");
    updateForm("foto", "");
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
            <h2 className="text-2xl font-semibold text-slate-900">Autorizar Visita</h2>
            <p className="text-sm text-slate-600">Registro rapido e intuitivo</p>
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
            <AlertTitle>Operacion exitosa</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden border-0 shadow-[0_18px_40px_rgba(30,41,59,0.12)]">
          <div className="bg-[linear-gradient(90deg,#a855f7_0%,#9333ea_45%,#9d00ff_100%)] px-5 py-6 text-white">
            <div className="flex items-center gap-3">
              <Zap className="size-5" />
              <h3 className="text-2xl font-semibold">Acceso Rapido</h3>
              <span className="rounded-full bg-white/15 px-3 py-1 text-sm">¡1 click!</span>
            </div>
            <p className="mt-3 text-lg text-white/95">
              Autoriza visitantes frecuentes instantaneamente
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
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#a855f7_0%,#9333ea_100%)] text-white">
                      <ShieldCheck className="size-7" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">{visitor.nombre}</p>
                      <p className="text-sm text-slate-500">
                        {visitor.placa || "Sin placa"} {visitor.dpi ? `• DPI: ${visitor.dpi}` : ""}
                      </p>
                      <p className="text-xs text-slate-400">
                        {visitor.total_visitas} visita{visitor.total_visitas !== 1 ? "s" : ""}
                        {visitor.ultima_fecha ? ` • Ultima: ${formatDate(visitor.ultima_fecha)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                          Autorizar (1 click)
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFrequentVisitor(visitor)}
                      className="rounded-2xl p-3 text-rose-500 transition hover:bg-rose-50"
                      aria-label={`Eliminar visitante frecuente ${visitor.nombre}`}
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
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
                  <span className="text-sm font-medium text-slate-800">DPI / Documento de Identidad (Opcional)</span>
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

                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">
                    Foto del Visitante (Opcional)
                  </span>
                  {photoPreview ? (
                    <div className="relative min-h-44 rounded-[28px] border border-slate-200 bg-white p-4">
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Quitar foto"
                      >
                        <X className="size-5" />
                      </button>
                      <img
                        src={photoPreview}
                        alt="Vista previa del visitante"
                        className="h-40 w-40 rounded-2xl border border-slate-200 object-cover shadow-sm"
                      />
                    </div>
                  ) : (
                    <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700">
                      <Camera className="size-11 text-slate-400" />
                      <span className="mt-4 text-2xl font-medium">Tomar o subir foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  )}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  La fecha y hora se completaron automaticamente con la hora actual. Puedes modificarlos si lo necesitas.
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

        <div className="space-y-4">
          <div>
            <h3 className="text-3xl font-semibold text-slate-900">
              Visitas Autorizadas Hoy ({todayVisits})
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Se muestran todas las visitas del residente con actualizacion dinamica.
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-slate-500">Cargando visitas autorizadas...</CardContent>
            </Card>
          ) : visits.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-slate-500">
                No hay visitas autorizadas para esta residencia.
              </CardContent>
            </Card>
          ) : (
            visits.map((visit) => (
              <Card
                key={visit.id_acceso}
                className="border-white/70 bg-white shadow-[0_12px_28px_rgba(30,41,59,0.08)]"
              >
                <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="flex gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#60a5fa_0%,#2563eb_100%)] text-white">
                      <UserRoundPlus className="size-7" />
                    </div>
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-2xl font-semibold text-slate-900">{visit.nombre}</p>
                        <button
                          type="button"
                          onClick={() => handleDelete(visit)}
                          className="rounded-full p-2 text-rose-500 transition hover:bg-rose-50"
                          aria-label={`Eliminar visita de ${visit.nombre}`}
                        >
                          <Trash2 className="size-5" />
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-slate-600">
                        <p>DPI: {visit.dpi}</p>
                        <p>Placa: {visit.placa}</p>
                        <p className="flex items-center gap-2">
                          <CalendarDays className="size-4" />
                          Fecha: {formatDate(visit.fecha)}
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock3 className="size-4" />
                          Hora: {visit.hora_inicio} - {visit.hora_fin}
                        </p>
                      </div>
                      <span className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                        {visitTypeLabels[visit.tipo_visita]}
                      </span>
                      <p className="mt-3 text-xs text-slate-400">
                        Estado: {visit.estado_acceso === "INGRESO_REGISTRADO" ? "Ingreso registrado" : "Autorizada"}
                      </p>
                    </div>
                  </div>
                  {visit.qr_value ? (
                    <QrCodeCard
                      value={visit.qr_value}
                      title={`QR ${visit.nombre}`}
                      description={`Casa ${visit.casa} • ${visit.fecha} • ${visit.hora_inicio}`}
                    />
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
