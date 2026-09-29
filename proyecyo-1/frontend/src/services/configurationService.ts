import { apiRequest } from "@/services/api";
import type { GeneralConfiguration, UpdateVisitSchedulePayload, VisitScheduleConfig } from "@/types/configuration";

export function getVisitScheduleConfigRequest() {
  return apiRequest<VisitScheduleConfig>("/configuracion/horarios-visita");
}

export function getGeneralConfigurationRequest() {
  return apiRequest<GeneralConfiguration>("/admin/configuracion/general");
}

export function updateGeneralConfigurationRequest(payload: GeneralConfiguration) {
  return apiRequest<GeneralConfiguration>("/admin/configuracion/general", {
    method: "PUT",
    body: payload,
  });
}

export function getAdminVisitScheduleConfigRequest() {
  return apiRequest<VisitScheduleConfig>("/admin/configuracion/horarios-visita");
}

export function updateVisitScheduleConfigRequest(payload: UpdateVisitSchedulePayload) {
  return apiRequest<VisitScheduleConfig>("/admin/configuracion/horarios-visita", {
    method: "PUT",
    body: payload,
  });
}
