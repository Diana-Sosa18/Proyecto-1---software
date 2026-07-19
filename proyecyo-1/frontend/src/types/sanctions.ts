export type AdminSanctionStatus = "PENDIENTE" | "PAGADA" | "ANULADA";

export type AdminSanctionFilterStatus = AdminSanctionStatus | "TODOS";

export interface AdminSanctionSummary {
  total: number;
  pendientes: number;
  pagadas: number;
  anuladas: number;
  monto_pendiente: number;
}

export interface AdminSanctionRule {
  codigo: string;
  nombre: string;
  descripcion: string;
  condicion: string;
  sancion: string;
  activa: boolean;
}

export interface AdminSanctionRecord {
  id_sancion: number;
  casa_unidad: string;
  residente: string;
  codigo_regla: string;
  motivo: string;
  detalle: string;
  monto: number;
  estado: AdminSanctionStatus;
  generada_automaticamente: boolean;
  fecha_incumplimiento: string;
  fecha_generacion: string;
  cuota_monto: number | null;
  fecha_limite: string | null;
  servicio: string | null;
}

export interface AdminSanctionHistoryRecord {
  id_historial: number;
  id_sancion: number;
  accion: "GENERACION_AUTOMATICA" | "CAMBIO_ESTADO";
  estado_anterior: AdminSanctionStatus | null;
  estado_nuevo: AdminSanctionStatus;
  detalle: string;
  realizado_por: string;
  creado_en: string;
  casa_unidad: string;
  residente: string;
  monto: number;
  motivo: string;
}

export interface AdminSanctionFilters {
  search?: string;
  house?: string;
  status?: AdminSanctionFilterStatus;
}

export interface AdminSanctionGenerationResult {
  generadas: number;
  fecha_revision: string;
}
