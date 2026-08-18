import { apiDownload, apiRequest } from "@/services/api";
import type { TenantAccountStatement } from "@/types/tenantAccount";
import type { SimulatedPaymentResult } from "@/services/accountService";

export function getTenantAccountStatementRequest(filters: { desde?: string; hasta?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.desde) query.set("desde", filters.desde);
  if (filters.hasta) query.set("hasta", filters.hasta);
  return apiRequest<TenantAccountStatement>(`/inquilino/estado-cuenta${query.size ? `?${query}` : ""}`);
}

export function payTenantObligationRequest(id_cuota: number) {
  return apiRequest<SimulatedPaymentResult>("/inquilino/pagos-simulados", {
    method: "POST", body: JSON.stringify({ id_cuota }),
  });
}

export function downloadTenantPaymentReceiptRequest(paymentId: number) {
  return apiDownload(`/inquilino/pagos/${paymentId}/comprobante`);
}
