import { apiRequest } from "@/services/api";
import type { AdminAccessRecord, AdminAccessStatus } from "@/types/accesses";

type AccessFilter = "TODOS" | AdminAccessStatus;

export function getAdminAccessesRequest(status: AccessFilter = "TODOS") {
  const query = status === "TODOS" ? "" : `?estado=${encodeURIComponent(status)}`;
  return apiRequest<AdminAccessRecord[]>(`/admin/accesos${query}`);
}