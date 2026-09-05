import { apiRequest } from "@/services/api";
import type { AuthorizedUserFilters, AuthorizedUserRecord } from "@/types/authorizedUsers";

function buildQuery(filters: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const normalized = String(value).trim();

    if (!normalized || normalized === "TODOS") {
      return;
    }

    query.set(key, normalized);
  });

  return query.toString();
}

export function getAuthorizedUsersRequest(filters: AuthorizedUserFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/usuarios-autorizados?${query}` : "/admin/usuarios-autorizados";
  return apiRequest<AuthorizedUserRecord[]>(url);
}
