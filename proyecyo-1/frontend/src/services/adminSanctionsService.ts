import { apiRequest } from "@/services/api";
import type {
  AdminSanctionFilters,
  AdminSanctionGenerationResult,
  AdminSanctionRecord,
  AdminSanctionRule,
  AdminSanctionStatus,
  AdminSanctionSummary,
} from "@/types/sanctions";

function buildSanctionQuery(filters: AdminSanctionFilters) {
  const query = new URLSearchParams();

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim());
  }

  if (filters.house?.trim()) {
    query.set("house", filters.house.trim());
  }

  if (filters.status && filters.status !== "TODOS") {
    query.set("status", filters.status);
  }

  return query.toString();
}

export function getAdminSanctionSummaryRequest() {
  return apiRequest<AdminSanctionSummary>("/admin/sanciones/resumen");
}

export function getAdminSanctionRulesRequest() {
  return apiRequest<AdminSanctionRule[]>("/admin/sanciones/reglas");
}

export function generateAdminSanctionsRequest() {
  return apiRequest<AdminSanctionGenerationResult>("/admin/sanciones/generar", {
    method: "POST",
  });
}

export function getAdminSanctionsRequest(filters: AdminSanctionFilters) {
  const query = buildSanctionQuery(filters);
  const url = query ? `/admin/sanciones?${query}` : "/admin/sanciones";
  return apiRequest<AdminSanctionRecord[]>(url);
}

export function updateAdminSanctionStatusRequest(id: number, estado: AdminSanctionStatus) {
  return apiRequest<AdminSanctionRecord>(`/admin/sanciones/${id}/estado`, {
    method: "PATCH",
    body: { estado },
  });
}
