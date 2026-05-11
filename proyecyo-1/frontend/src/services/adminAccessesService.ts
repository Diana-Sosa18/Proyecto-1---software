import { apiRequest } from "@/services/api";
import type {
  AdminAccessFilters,
  AdminAccessHourlyPoint,
  AdminAccessRecord,
  AdminAccessSummary,
} from "@/types/accesses";

function buildAccessQuery(filters: AdminAccessFilters) {
  const query = new URLSearchParams();

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim());
  }

  if (filters.house?.trim()) {
    query.set("house", filters.house.trim());
  }

  if (filters.plate?.trim()) {
    query.set("plate", filters.plate.trim());
  }

  if (filters.type && filters.type !== "TODOS") {
    query.set("type", filters.type);
  }

  if (filters.status && filters.status !== "TODOS") {
    query.set("status", filters.status);
  }

  return query.toString();
}

export function getAdminAccessSummaryRequest() {
  return apiRequest<AdminAccessSummary>("/admin/accesos/resumen");
}

export function getAdminAccessHourlyChartRequest() {
  return apiRequest<AdminAccessHourlyPoint[]>("/admin/accesos/grafica-horas");
}

export function getAdminAccessesRequest(filters: AdminAccessFilters) {
  const query = buildAccessQuery(filters);
  return apiRequest<AdminAccessRecord[]>(query ? `/admin/accesos?${query}` : "/admin/accesos");
}
