import type { AccountQuotaStatus } from "@/types/account";

export interface TenantAccountQuota {
  id_cuota: number;
  id_casa: number;
  casa_unidad: string;
  servicio: string;
  tipo_servicio: string;
  monto: number;
  monto_base: number;
  recargo: number;
  monto_pagado: number;
  saldo_pendiente: number;
  fecha_limite: string;
  ultimo_pago: string | null;
  estado: AccountQuotaStatus;
  es_alquiler: boolean;
}

export interface TenantAccountSummary {
  total_cuotas: number;
  cuotas_pagadas: number;
  cuotas_pendientes: number;
  cuotas_vencidas: number;
  saldo_pendiente: number;
  alquiler_pendiente: number;
  cuotas_adicionales_pendientes: number;
  total_pagado: number;
  proximo_vencimiento: string | null;
  actualizado_en: string;
}

export interface TenantAccountHouse {
  id_casa: number;
  unidad: string;
  propietario: string;
}

export interface TenantAccountStatement {
  casa: TenantAccountHouse;
  resumen: TenantAccountSummary;
  alquiler: TenantAccountQuota[];
  cuotas_adicionales: TenantAccountQuota[];
  pagos: Array<{
    id_pago: number;
    id_cuota: number;
    servicio: string;
    monto_pagado: number;
    fecha_pago: string;
    numero_comprobante: string;
  }>;
  recargos: Array<{ id_recargo: number; id_cuota: number; servicio: string; monto_recargo: number; fecha_aplicacion: string }>;
  periodo: { desde: string | null; hasta: string | null };
}
