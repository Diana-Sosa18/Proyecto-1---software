import { apiRequest } from "@/services/api";
import type { TenantAccountStatement } from "@/types/tenantAccount";

export function getTenantAccountStatementRequest() {
  return apiRequest<TenantAccountStatement>("/inquilino/estado-cuenta");
}
