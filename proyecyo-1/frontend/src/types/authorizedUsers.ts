export interface AuthorizedUserRecord {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  unidades: string;
  permisos_activos: string[];
  total_permisos_activos: number;
}

export interface AuthorizedUserFilters {
  search?: string;
}
