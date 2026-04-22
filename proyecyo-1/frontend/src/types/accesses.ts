export type AdminAccessType = "RESIDENTE" | "VISITANTE" | "PROVEEDOR";

export type AdminAccessStatus = "APROBADO" | "PENDIENTE" | "RECHAZADO";

export type AdminAccessFilterType = AdminAccessType | "TODOS";

export type AdminAccessFilterStatus = AdminAccessStatus | "TODOS";

export interface AdminAccessSummary {
  total_dia: number;
  aprobados: number;
  pendientes: number;
  rechazados: number;
}

export interface AdminAccessRecord {
  id_acceso: number;
  fecha: string;
  hora: string;
  tipo: AdminAccessType;
  nombre: string;
  casa_unidad: string;
  placa: string;
  estado: AdminAccessStatus;
  autorizado_por: string;
}

export interface AdminAccessFilters {
  search?: string;
  type?: AdminAccessFilterType;
  status?: AdminAccessFilterStatus;
}
