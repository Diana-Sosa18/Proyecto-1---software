import { apiRequest } from "@/services/api";
import { notifyAccessCountersChanged } from "@/utils/accessCounterUpdates";
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

export async function createSpecialAccessRequest(payload: SpecialAccessPayload) {
  const access = await apiRequest<SpecialAccessRecord>("/admin/accesos-especiales", {
    method: "POST",
    body: payload,
  });
  notifyAccessCountersChanged();
  return access;
}

export async function approveSpecialAccessRequest(accessId: number) {
  const access = await apiRequest<SpecialAccessRecord>(`/admin/accesos-especiales/${accessId}/aprobar`, {
    method: "PATCH",
  });
  notifyAccessCountersChanged();
  return access;
}

export async function rejectSpecialAccessRequest(accessId: number, motivo?: string) {
  const access = await apiRequest<{ id_acceso: number; estado_acceso: string }>(
    `/admin/accesos-especiales/${accessId}/rechazar`,
    {
      method: "PATCH",
      body: { motivo },
    },
  );
  notifyAccessCountersChanged();
  return access;
}
