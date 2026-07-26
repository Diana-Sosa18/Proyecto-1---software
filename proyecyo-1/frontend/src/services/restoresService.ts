import { apiRequest } from "@/services/api";
import type {
  BackupPayload,
  BackupValidation,
  RestoreHistoryRecord,
  RestoreResult,
} from "@/types/restores";

export function getRestoreHistoryRequest() {
  return apiRequest<RestoreHistoryRecord[]>("/admin/restauraciones");
}

export function validateBackupRequest(payload: BackupPayload) {
  return apiRequest<BackupValidation>("/admin/restauraciones/validar", {
    method: "POST",
    body: payload,
  });
}

export function restoreBackupRequest(payload: BackupPayload) {
  return apiRequest<RestoreResult>("/admin/restauraciones", {
    method: "POST",
    body: payload,
  });
}
