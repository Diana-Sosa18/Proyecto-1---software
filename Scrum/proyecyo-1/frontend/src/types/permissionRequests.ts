export type PermissionRequestStatus =
  | "PENDIENTE"
  | "APROBADO"
  | "RECHAZADO"
  | "CANCELADA";

export type PermissionRequestType =
  | "VISITA"
  | "PROVEEDOR"
  | "DELIVERY"
  | "AMENIDAD"
  | "OTRO";

export interface PermissionRequestRecord {
  id_solicitud_permiso: number;
  tipo_permiso: PermissionRequestType;
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones: string | null;
  estado: PermissionRequestStatus;
  created_at: string;
}

export interface CreatePermissionRequestPayload {
  tipo_permiso: PermissionRequestType;
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones: string;
}