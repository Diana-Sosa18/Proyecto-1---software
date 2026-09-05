export interface TenantPermission {
  id_permiso: number;
  nombre: string;
  descripcion: string;
  restriccion: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: "ACTIVO" | "INACTIVO" | "PENDIENTE";
}

export interface AuthorizationRequest {
  id_solicitud: number;
  accion: string;
  motivo: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  respuesta: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Regulation {
  id_reglamento: number;
  categoria: string;
  titulo: string;
  contenido: string;
  actualizado_en: string;
}

export interface GuardAccessHistoryRecord {
  id_acceso: number;
  visitante: string;
  placa: string;
  casa: string;
  tipo_visita: string;
  estado: "PENDIENTE" | "INGRESO" | "SALIDA" | "CANCELADA";
  hora_programada: string;
  hora_ingreso: string | null;
  hora_salida: string | null;
}
