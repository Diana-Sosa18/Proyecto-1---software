import { apiRequest } from "@/services/api";
import type { AuthorizedUserFilters, AuthorizedUserRecord } from "@/types/authorizedUsers";
import { buildQuery } from "@/utils/queryString";

export function getAuthorizedUsersRequest(filters: AuthorizedUserFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/usuarios-autorizados?${query}` : "/admin/usuarios-autorizados";
  return apiRequest<AuthorizedUserRecord[]>(url);
}
