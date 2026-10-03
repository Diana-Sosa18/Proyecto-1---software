import { apiDownload, apiRequest, ApiError } from "@/services/api";
import type { PaymentReceipt } from "@/types/paymentReceipt";

export function getResidentPaymentReceiptRequest(paymentId: number) {
  return apiRequest<PaymentReceipt>(`/residente/pagos/${paymentId}/comprobante/datos`);
}
export function getResidentRecurrenteReceiptsRequest() {
  return apiRequest<PaymentReceipt[]>("/residente/pagos/recurrente/comprobantes");
}
export function downloadPaymentReceiptRequest(paymentId: number) {
  return apiDownload(`/residente/pagos/${paymentId}/comprobante`);
}
export function receiptErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Inicia sesión para consultar el comprobante.";
    if (error.status === 403) return "No tienes autorización para consultar este comprobante.";
    if (error.status === 404) return "No se encontró el comprobante solicitado.";
    if (error.status === 409) return "La transacción no tiene un pago confirmado. No hay comprobante disponible.";
  }
  return "No fue posible consultar o descargar el comprobante. Intenta nuevamente.";
}

export function savePaymentReceipt(blob: Blob, reference: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobante-${reference}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
