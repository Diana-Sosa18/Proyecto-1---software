import { apiRequest, ApiError } from '@/services/api';
export type RefundState = 'SOLICITADO' | 'PENDIENTE' | 'CONFIRMADO' | 'FALLIDO' | 'INCIERTO' | 'REVISION' | 'CANCELADO';
export type RecurrenteRefund = { id_reembolso: number; id_transaccion: number; referencia_local: string | null; id_externo: string | null;
  monto_centavos: number; moneda: string; ambiente: string; tipo: string; estado: RefundState; motivo: string | null;
  estado_proveedor: string | null; error_codigo: string | null; creado_en: string; fecha_contable: string | null;
  aplicado_en: string | null; evidencia_confirmacion: string | null };
export type RefundEligibility = { id_transaccion: number; id_pago: number | null; id_cuota: number; id_checkout: number;
  numero_comprobante: string | null; concepto: string; residente: string; unidad: string; fecha_pago: string | null;
  fecha_limite: string; estado: string; ambiente: string; moneda: string; original_centavos: number; devuelto_centavos: number;
  reservado_centavos: number; disponible_centavos: number; abono_neto_centavos: number; elegible: boolean;
  motivo_inhabilitacion: string | null; requiere_verificacion_proveedor: boolean; reembolsos: RecurrenteRefund[] };
export const refundEligibility = (id: number) => apiRequest<RefundEligibility>(`/admin/pagos/recurrente/${id}/refund-eligibility`);
export const refundHistory = (id: number) => apiRequest<RecurrenteRefund[]>(`/admin/pagos/recurrente/${id}/refunds`);
export const requestTotalRefund = (id: number, motivo: string, requestId: string) => apiRequest<{result: string; refund: RecurrenteRefund}>(
  `/admin/pagos/recurrente/${id}/refunds`, { method: 'POST', body: { motivo, idempotency_key: requestId } });
export const verifyRefund = (id: number) => apiRequest<{result: string; refund: RecurrenteRefund}>(
  `/admin/pagos/recurrente/reembolsos/${id}/verificar`, { method: 'POST', body: {} });
export function refundError(error: unknown) {
  const code = error instanceof ApiError && typeof error.payload === 'object' && error.payload !== null && 'code' in error.payload ? String(error.payload.code) : '';
  if (['REFUND_UNKNOWN','REFUND_PERSISTENCE'].includes(code)) return 'El resultado es incierto. No repitas la solicitud. Consulta el historial y verifica la referencia conocida.';
  if (code === 'REFUND_PROVIDER_REJECTED') return 'El proveedor rechazó la solicitud. No se aplicó ningún reembolso.';
  if (code === 'REFUND_EXTERNAL_EVIDENCE') return 'No se pudo verificar la elegibilidad en el Sandbox. No se envió el reembolso.';
  if (code === 'REFUND_INVALID_REQUEST') return 'Revisa el motivo. Solo se permiten reembolsos totales y no deben incluirse datos de tarjeta.';
  if (error instanceof ApiError && error.status === 401) return 'Inicia sesión nuevamente.';
  if (error instanceof ApiError && error.status === 403) return 'Acceso exclusivo para administradores.';
  if (error instanceof ApiError && error.status === 409) return 'La operación no es elegible o está bloqueada. Consulta su historial.';
  return 'No fue posible consultar el resultado. No repitas una solicitud financiera; actualiza los registros locales.';
}
