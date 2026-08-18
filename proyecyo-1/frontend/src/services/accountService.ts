import { apiRequest } from "@/services/api";
import type { AccountStatement } from "@/types/account";

export interface SimulatedPaymentResult {
  id_transaccion: number; id_pago: number; id_cuota: number; concepto: string;
  monto_base: number; recargo: number; total: number; estado: "APROBADA";
  fecha_limite: string; numero_comprobante: string;
}

export function getResidentAccountStatementRequest() {
  return apiRequest<AccountStatement>("/residente/estado-cuenta");
}

export function payResidentObligationRequest(id_cuota: number) {
  return apiRequest<SimulatedPaymentResult>("/residente/pagos-simulados", {
    method: "POST", body: JSON.stringify({ id_cuota }),
  });
}
