export interface Amenity {
  id_amenidad: number;
  nombre: string;
}

export interface AmenityReservation {
  id_usuario: number;
  id_amenidad: number;
  amenidad_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface CreateAmenityReservationPayload {
  id_amenidad: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}
