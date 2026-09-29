import { apiRequest } from "@/services/api";
import type { AuditFilters, AuditRecord } from "@/types/audit";

export function getAuditLogsRequest(filters: AuditFilters = {}) {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return apiRequest<AuditRecord[]>(`/admin/auditoria${query ? `?${query}` : ""}`);
}
