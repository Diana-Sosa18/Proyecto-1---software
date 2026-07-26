import { useEffect, useState } from "react";
import { Bell, Clock3, LockKeyhole, Palette, ShieldCheck } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminVisitScheduleConfigRequest,
  updateVisitScheduleConfigRequest,
} from "@/services/configurationService";
import type { VisitScheduleConfig } from "@/types/configuration";
import {
  formatVisitScheduleSummary,
  validateVisitScheduleForm,
} from "@/utils/visitSchedule";

const FIELD_CLASS_NAME =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[0.82rem] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

const DEFAULT_SCHEDULE: VisitScheduleConfig = {
  hora_apertura: "06:00",
  hora_cierre: "22:00",
  duracion_maxima_horas: 4,
  activo: true,
  dias_habilitados: [1, 2, 3, 4, 5, 6, 0],
};
const DAYS = [
  ["Dom", 0], ["Lun", 1], ["Mar", 2], ["Mie", 3], ["Jue", 4], ["Vie", 5], ["Sab", 6],
] as const;

const settingsGroups = [
  {
    title: "Seguridad",
    icon: LockKeyhole,
    items: ["Politicas de acceso", "Sesiones activas", "Permisos administrativos"],
  },
  {
    title: "Notificaciones",
    icon: Bell,
    items: ["Alertas internas", "Correos automaticos", "Recordatorios visuales"],
  },
  {
    title: "Interfaz",
    icon: Palette,
    items: ["Preferencias del panel", "Jerarquia visual", "Componentes base"],
  },
  {
    title: "Control",
    icon: ShieldCheck,
    items: ["Estados operativos", "Etiquetas visibles", "Validaciones del modulo"],
  },
];

export function AdminSettingsView() {
  const [scheduleForm, setScheduleForm] = useState<VisitScheduleConfig>(DEFAULT_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const schedule = await getAdminVisitScheduleConfigRequest();

        if (active) {
          setScheduleForm(schedule);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No fue posible cargar los horarios de visita.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, []);

  async function handleScheduleSubmit() {
    const validationError = validateVisitScheduleForm(scheduleForm);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      const updated = await updateVisitScheduleConfigRequest(scheduleForm);
      setScheduleForm(updated);
      setSuccessMessage("Los horarios generales de visita fueron actualizados.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible guardar los horarios.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminLayout
      title="Configuracion"
      subtitle="Ajustes generales del panel administrativo y reglas de acceso."
    >
      <div className="space-y-6">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert>
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-[20px] border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Clock3 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-[1.12rem]">Horarios generales de visita</CardTitle>
                <CardDescription className="mt-1">
                  Define el rango horario permitido y la duracion maxima para autorizar visitas.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando configuracion...</p>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Resumen actual:{" "}
                  <span className="font-medium text-slate-900">
                    {formatVisitScheduleSummary(scheduleForm)}
                  </span>
                  {" · "}
                  {scheduleForm.activo ? "Autorizaciones activas" : "Autorizaciones pausadas"}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Hora de apertura</label>
                    <Input
                      type="time"
                      value={scheduleForm.hora_apertura}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          hora_apertura: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Hora de cierre</label>
                    <Input
                      type="time"
                      value={scheduleForm.hora_cierre}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          hora_cierre: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Duracion maxima (horas)
                    </label>
                    <select
                      value={String(scheduleForm.duracion_maxima_horas)}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          duracion_maxima_horas: Number(event.target.value),
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((hours) => (
                        <option key={hours} value={hours}>
                          {hours} hora{hours === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Estado</label>
                    <select
                      value={scheduleForm.activo ? "activo" : "inactivo"}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          activo: event.target.value === "activo",
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    >
                      <option value="activo">Autorizaciones activas</option>
                      <option value="inactivo">Autorizaciones pausadas</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Dias habilitados</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(([label, day]) => (
                      <label key={day} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={scheduleForm.dias_habilitados.includes(day)}
                          onChange={() => setScheduleForm((current) => ({
                            ...current,
                            dias_habilitados: current.dias_habilitados.includes(day)
                              ? current.dias_habilitados.filter((value) => value !== day)
                              : [...current.dias_habilitados, day],
                          }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={handleScheduleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Guardando..." : "Guardar horarios"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          {settingsGroups.map(({ title, icon: Icon, items }) => (
            <article
              key={title}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 text-[1.12rem] font-semibold text-slate-950">{title}</h2>
              <div className="mt-3 grid gap-2">
                {items.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[0.82rem] text-slate-600"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AdminLayout>
  );
}
