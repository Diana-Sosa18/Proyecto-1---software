export type TenantProviderStatus = "VALIDADO" | "PENDIENTE";

export interface TenantProvider {
  id_servicio: number;
  nombre: string;
  tipo_servicio: string;
  descripcion: string;
  activo: boolean;
  estado: TenantProviderStatus;
  casa_unidad: string;
}
