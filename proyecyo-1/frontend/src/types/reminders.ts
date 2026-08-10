export type ReminderType = "PROXIMO_VENCIMIENTO" | "VENCIDO";

export type ReminderFilterType = ReminderType | "TODOS";

export interface ReminderConfig {
  activo: boolean;
  dias_antes: number;
}

export interface ReminderSummary {
  total: number;
  proximos: number;
  vencidos: number;
  enviados_hoy: number;
}

export interface ReminderRecord {
  id_recordatorio: number;
  casa_unidad: string;
  residente: string;
  correo: string | null;
  tipo: ReminderType;
  titulo: string;
  mensaje: string;
  monto: number;
  fecha_limite: string;
  dias_para_vencer: number;
  servicio: string | null;
  enviado_en: string;
}

export interface ReminderFilters {
  search?: string;
  type?: ReminderFilterType;
}

export interface ReminderGenerationResult {
  enviados: number;
  fecha_revision: string;
  activo: boolean;
}
