import type { VisitScheduleConfig } from "@/types/configuration";
import { validateTimeRange } from "@/utils/dateTimeValidation";

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateVisitTimesAgainstSchedule(
  horaInicio: string,
  horaFin: string,
  schedule: VisitScheduleConfig,
): string | null {
  if (!schedule.activo) {
    return "Las autorizaciones de visita estan temporalmente deshabilitadas.";
  }

  const rangeError = validateTimeRange(horaInicio, horaFin);
  if (rangeError) return rangeError;

  const startMinutes = toMinutes(horaInicio);
  const endMinutes = toMinutes(horaFin);
  const openingMinutes = toMinutes(schedule.hora_apertura);
  const closingMinutes = toMinutes(schedule.hora_cierre);
  const maxDurationMinutes = schedule.duracion_maxima_horas * 60;

  if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
    return `El horario debe estar entre ${schedule.hora_apertura} y ${schedule.hora_cierre}.`;
  }

  if (endMinutes - startMinutes > maxDurationMinutes) {
    return `La visita no puede durar mas de ${schedule.duracion_maxima_horas} hora(s).`;
  }

  return null;
}

export function validateVisitScheduleForm(payload: VisitScheduleConfig): string | null {
  const rangeError = validateTimeRange(payload.hora_apertura, payload.hora_cierre);
  if (rangeError) return rangeError.replace("hora de inicio", "hora de apertura").replace("hora de fin", "hora de cierre");

  if (payload.duracion_maxima_horas < 1 || payload.duracion_maxima_horas > 12) {
    return "La duracion maxima debe estar entre 1 y 12 horas.";
  }

  const windowMinutes = toMinutes(payload.hora_cierre) - toMinutes(payload.hora_apertura);

  if (windowMinutes < payload.duracion_maxima_horas * 60) {
    return "La duracion maxima no puede ser mayor al rango horario permitido.";
  }

  return null;
}

export function formatVisitScheduleSummary(schedule: VisitScheduleConfig) {
  return `${schedule.hora_apertura} - ${schedule.hora_cierre} (max. ${schedule.duracion_maxima_horas} h)`;
}
