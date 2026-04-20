export type AdminAccessStatus = "AUTORIZADA" | "INGRESO_REGISTRADO" | "CANCELADA";

export interface AdminAccessRecord {
  id_acceso: number;
  hora: string;
  nombre: string;
  casa: string;
  placa: string;
  estado: AdminAccessStatus;
  fecha: string;
  tipo_visita: string;
}