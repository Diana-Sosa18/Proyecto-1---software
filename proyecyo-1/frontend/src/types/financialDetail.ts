import type { AccountQuotaStatus } from "./account";
import type { FinancialBalanceDetails, FinancialReview } from "./financialBalance";
// HU32: mismo estado que Mis pagos (regla unica del backend).
export type ChargeStatus = AccountQuotaStatus;

export interface FinancialCharge extends FinancialBalanceDetails {
  id_cuota: number;
  servicio: string;
  monto: number;
  pagado: number;
  recargo: number;
  saldo: number;
  fecha_limite: string;
  estado: ChargeStatus;
  pago_parcial: boolean;
}

export interface FinancialSurcharge {
  id_recargo: number;
  id_cuota: number;
  servicio: string;
  tipo_regla: string;
  monto_original: number;
  monto_recargo: number;
  fecha_aplicacion: string;
}

export interface FinancialPayment {
  id_pago: number;
  id_cuota: number;
  servicio: string;
  monto_pagado: number;
  fecha_pago: string;
  numero_comprobante: string;
}

export interface FinancialSummary extends FinancialReview {
  total_reembolsado?: number; abono_neto?: number; total_devuelto_periodo?: number;
  total_pagado_periodo?: number;
  total_cargos: number;
  total_recargos: number;
  total_pagado: number;
  saldo_pendiente: number;
}

export interface FinancialDetail {
  unidad: string;
  periodo: {
    desde: string | null;
    hasta: string | null;
  };
  resumen: FinancialSummary;
  cargos: FinancialCharge[];
  recargos: FinancialSurcharge[];
  pagos: FinancialPayment[];
  reembolsos?: {id_reembolso:number;id_pago:number;id_cuota:number;monto_centavos:number;fecha_reembolso:string;servicio:string}[];
}

export interface FinancialDetailFilters {
  desde?: string;
  hasta?: string;
}
