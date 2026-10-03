import { apiRequest, ApiError } from '@/services/api';
import type { ReconciliationFilters, ReconciliationResponse } from '@/types/recurrenteReconciliation';
export function listRecurrenteTransactions(filters: ReconciliationFilters) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]);
  return apiRequest<ReconciliationResponse>(`/admin/pagos/recurrente/transacciones?${query}`);
}
export function verifyRecurrenteTransactions(filters: ReconciliationFilters, discover: boolean) {
  return apiRequest<ReconciliationResponse>('/admin/pagos/recurrente/conciliacion', { method: 'POST', body: { filtros: filters, descubrir_externas: discover } });
}
export function reconciliationError(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 401) return 'Inicia sesión nuevamente para consultar la conciliación.';
  if (status === 403) return 'Esta consulta está disponible solamente para administradores.';
  if (status === 400) return 'Revisa los filtros y el período seleccionado.';
  if (status === 429) return 'Se alcanzó el límite de consultas. Intenta más tarde.';
  return 'No fue posible consultar la conciliación. Intenta nuevamente.';
}
