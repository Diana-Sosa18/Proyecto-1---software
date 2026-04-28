import { apiRequest } from "@/services/api";
import type {
  AdminAccessFilters,
  AdminAccessRecord,
  AdminAccessSummary,
} from "@/types/accesses";

function buildAccessQuery(filters: AdminAccessFilters) {
  const query = new URLSearchParams();

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim());
  }

  if (filters.type && filters.type !== "TODOS") {
    query.set("type", filters.type);
  }

  if (filters.status && filters.status !== "TODOS") {
    query.set("status", filters.status);
  }

  return query.toString();
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Error de conexion con el backend.");
}

export function getAdminAccessSummaryRequest() {
  return withRetry(() => apiRequest<AdminAccessSummary>("/admin/accesos/resumen"));
}

export function getAdminAccessesRequest(filters: AdminAccessFilters) {
  const query = buildAccessQuery(filters);
  const url = query ? `/admin/accesos?${query}` : "/admin/accesos";
  return withRetry(() => apiRequest<AdminAccessRecord[]>(url));
}
