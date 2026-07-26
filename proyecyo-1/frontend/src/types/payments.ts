export type AdminPaymentStatus = "MOROSO" | "PENDIENTE" | "PAGADO";

export interface AdminPaymentRecord {
  id_casa: number;
  unidad: string;
  propietario_nombre: string;
  propietario_correo: string;
  monto_pendiente: number;
  recargo_aplicado: number;
  total_pendiente: number;
  fecha_limite: string | null;
  estado: AdminPaymentStatus;
}

export interface AdminPaymentFilters {
  search?: string;
  estado?: AdminPaymentStatus | "TODOS";
  date?: string;
}
