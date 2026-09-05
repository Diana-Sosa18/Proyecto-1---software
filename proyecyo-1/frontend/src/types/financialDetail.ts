export type ChargeStatus = "PAGADO" | "PARCIAL" | "PENDIENTE";

export interface FinancialCharge {
  id_cuota: number;
  servicio: string;
  monto: number;
  pagado: number;
  recargo: number;
  saldo: number;
  fecha_limite: string;
  estado: ChargeStatus;
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
}

export interface FinancialSummary {
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
}

export interface FinancialDetailFilters {
  desde?: string;
  hasta?: string;
}
