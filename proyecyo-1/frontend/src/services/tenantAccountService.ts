import { apiDownload, apiRequest } from "@/services/api";
import type { TenantAccountStatement } from "@/types/tenantAccount";

export function getTenantAccountStatementRequest(filters: { desde?: string; hasta?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.desde) query.set("desde", filters.desde);
  if (filters.hasta) query.set("hasta", filters.hasta);
  return apiRequest<TenantAccountStatement>(`/inquilino/estado-cuenta${query.size ? `?${query}` : ""}`);
}

export function downloadTenantPaymentReceiptRequest(paymentId: number) {
  return apiDownload(`/inquilino/pagos/${paymentId}/comprobante`);
}
