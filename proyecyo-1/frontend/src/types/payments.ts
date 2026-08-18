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

export interface RecentPaymentRecord {
  id_transaccion: number; id_pago: number; id_usuario: number; usuario: string;
  rol: "residente" | "inquilino"; unidad: string; concepto: string; monto: number;
  fecha: string; hora: string; estado: "APROBADA" | "RECHAZADA";
}

export interface RecentPaymentFilters {
  usuario?: string; unidad?: string; desde?: string; hasta?: string;
  estado?: "APROBADA" | "RECHAZADA" | "TODOS"; rol?: "RESIDENTE" | "INQUILINO" | "TODOS";
}
