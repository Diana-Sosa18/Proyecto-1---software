import { apiDownload, apiRequest } from "@/services/api";
import type { FinancialDetail, FinancialDetailFilters } from "@/types/financialDetail";

function buildFinancialQuery(filters: FinancialDetailFilters) {
  const query = new URLSearchParams();

  if (filters.desde?.trim()) {
    query.set("desde", filters.desde.trim());
  }

  if (filters.hasta?.trim()) {
    query.set("hasta", filters.hasta.trim());
  }

  return query.toString();
}

export function downloadResidentPaymentReceiptRequest(paymentId: number) {
  return apiDownload(`/residente/pagos/${paymentId}/comprobante`);
}

export function getFinancialDetailRequest(filters: FinancialDetailFilters = {}) {
  const query = buildFinancialQuery(filters);
  const url = query ? `/residente/detalle-financiero?${query}` : "/residente/detalle-financiero";
  return apiRequest<FinancialDetail>(url);
}
