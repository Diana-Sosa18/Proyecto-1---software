import { apiRequest } from "@/services/api";
import type {
  HouseOption,
  SpecialAccessExceptionRecord,
  SpecialAccessPayload,
  SpecialAccessRecord,
  VisitScheduleConfig,
} from "@/types/announcements";

export function getVisitScheduleConfigRequest() {
  return apiRequest<VisitScheduleConfig>("/admin/accesos-especiales/horario");
}

export function getHousesRequest() {
  return apiRequest<HouseOption[]>("/admin/accesos-especiales/casas");
}

export function getPendingSpecialAccessesRequest() {
  return apiRequest<SpecialAccessRecord[]>("/admin/accesos-especiales/pendientes");
}

export function getSpecialAccessHistoryRequest() {
  return apiRequest<SpecialAccessExceptionRecord[]>("/admin/accesos-especiales/historial");
}

export function createSpecialAccessRequest(payload: SpecialAccessPayload) {
  return apiRequest<SpecialAccessRecord>("/admin/accesos-especiales", {
    method: "POST",
    body: payload,
  });
}

export function approveSpecialAccessRequest(accessId: number) {
  return apiRequest<SpecialAccessRecord>(`/admin/accesos-especiales/${accessId}/aprobar`, {
    method: "PATCH",
  });
}

export function rejectSpecialAccessRequest(accessId: number, motivo?: string) {
  return apiRequest<{ id_acceso: number; estado_acceso: string }>(
    `/admin/accesos-especiales/${accessId}/rechazar`,
    {
      method: "PATCH",
      body: { motivo },
    },
  );
}
