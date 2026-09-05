import { apiRequest } from "@/services/api";
import type { UpdateVisitSchedulePayload, VisitScheduleConfig } from "@/types/configuration";

export function getVisitScheduleConfigRequest() {
  return apiRequest<VisitScheduleConfig>("/configuracion/horarios-visita");
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
