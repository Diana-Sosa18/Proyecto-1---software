export type VisitType = "VISITA" | "DELIVERY" | "PROVEEDOR";

export interface VisitRecord {
  id_acceso: number;
  id_visitante: number;
  nombre: string;
  dpi: string;
  placa: string;
  foto?: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_visita: VisitType;
  casa?: string;
}

export interface FrequentVisitor {
  id_visitante: number;
  nombre: string;
  dpi: string;
  placa: string;
  total_visitas: number;
  ultima_fecha: string | null;
}

export interface VisitPayload {
  nombre: string;
  dpi: string;
  placa: string;
  foto?: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_visita: VisitType;
}
