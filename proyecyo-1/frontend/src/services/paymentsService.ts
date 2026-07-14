import { apiRequest } from "@/services/api";
import type { AdminPaymentFilters, AdminPaymentRecord } from "@/types/payments";

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

export function getAdminPaymentsRequest(filters: AdminPaymentFilters = {}) {
  const query = buildQuery(filters);
  const url = query ? `/admin/pagos?${query}` : "/admin/pagos";
  return apiRequest<AdminPaymentRecord[]>(url);
}
