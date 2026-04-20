export interface Amenity {
  id_amenidad: number;
  nombre: string;
  descripcion: string;
  hora_apertura: string;
  hora_cierre: string;
  intervalo_minutos: number;
  activo: boolean;
}

export interface AmenityReservation {
  reservation_key: string;
  id_usuario: number;
  id_amenidad: number;
  amenidad_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: "PENDIENTE" | "CONFIRMADA" | "CANCELADA";
  estado_actual: "PENDIENTE" | "CONFIRMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
  usuario_nombre?: string;
  usuario_rol?: "residente" | "inquilino" | "admin" | "guardia";
  unidad?: string;
}

export interface AmenityAvailabilitySlot {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
  reserva: AmenityReservation | null;
}

export interface AmenityAvailabilityResponse {
  amenidad: Amenity;
  fecha: string;
  slots: AmenityAvailabilitySlot[];
  reservas: AmenityReservation[];
}

export interface AmenityConflictResponse {
  conflicto: boolean;
  reserva: AmenityReservation | null;
}

export interface ReservableUserOption {
  id_usuario: number;
  nombre: string;
  rol: "residente" | "inquilino";
  unidad: string;
}

export interface CreateAmenityReservationPayload {
  id_usuario?: number;
  id_amenidad: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface UpdateAmenitySchedulePayload {
  descripcion?: string;
  hora_apertura: string;
  hora_cierre: string;
  intervalo_minutos: number;
  activo: boolean;
}
