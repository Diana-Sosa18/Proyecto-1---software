import { apiRequest } from "@/services/api";
import type {
  CreatePermissionRequestPayload,
  PermissionRequestRecord,
} from "@/types/permissionRequests";

export function getOwnPermissionRequestsRequest() {
  return apiRequest<PermissionRequestRecord[]>("/solicitudes-permiso/mias");
}

export function createPermissionRequestRequest(payload: CreatePermissionRequestPayload) {
  return apiRequest<PermissionRequestRecord>("/solicitudes-permiso", {
    method: "POST",
    body: payload,
  });
}   

export function cancelPermissionRequestRequest(id: number) {
  return apiRequest<PermissionRequestRecord>(`/solicitudes-permiso/${id}/cancelar`, {
    method: "PATCH",
  });
}