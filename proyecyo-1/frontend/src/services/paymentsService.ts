import { apiRequest } from "@/services/api";
import type { AdminPaymentFilters, AdminPaymentRecord, RecentPaymentFilters, RecentPaymentRecord } from "@/types/payments";
import { buildQuery } from "@/utils/queryString";

export function getRecentPaymentsRequest(filters: RecentPaymentFilters = {}) {
  const query = buildQuery(filters);
  return apiRequest<RecentPaymentRecord[]>(`/admin/pagos/recientes${query ? `?${query}` : ""}`);
}

export function getAdminPaymentsRequest(filters: AdminPaymentFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/pagos?${query}` : "/admin/pagos";
  return apiRequest<AdminPaymentRecord[]>(url);
}
