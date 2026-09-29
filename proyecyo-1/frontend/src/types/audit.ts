export interface AuditRecord {
  id_auditoria: number;
  id_usuario: number | null;
  usuario_nombre: string | null;
  usuario_correo: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  direccion_ip: string | null;
  creado_en: string;
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}
