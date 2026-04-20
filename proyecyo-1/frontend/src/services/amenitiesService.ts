import { apiRequest } from "@/services/api";
import type {
  Amenity,
  AmenityAvailabilityResponse,
  AmenityConflictResponse,
  AmenityReservation,
  CreateAmenityReservationPayload,
  ReservableUserOption,
  UpdateAmenitySchedulePayload,
} from "@/types/amenities";

type ReservationFilters = {
  from: string;
  to: string;
  id_amenidad?: number | null;
  id_usuario?: number | null;
};

function buildReservationQuery(filters: ReservationFilters) {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
  });

  if (filters.id_amenidad) {
    query.set("id_amenidad", String(filters.id_amenidad));
  }

  if (filters.id_usuario) {
    query.set("id_usuario", String(filters.id_usuario));
  }

  return query.toString();
}

function buildAvailabilityQuery(idAmenidad: number, fecha: string) {
  return new URLSearchParams({
    id_amenidad: String(idAmenidad),
    fecha,
  }).toString();
}

function buildConflictQuery(payload: CreateAmenityReservationPayload) {
  const query = new URLSearchParams({
    id_amenidad: String(payload.id_amenidad),
    fecha: payload.fecha,
    hora_inicio: payload.hora_inicio,
    hora_fin: payload.hora_fin,
  });

  if (payload.id_usuario) {
    query.set("id_usuario", String(payload.id_usuario));
  }

  return query.toString();
}

export function getAmenitiesRequest() {
  return apiRequest<Amenity[]>("/amenidades");
}

export function getAmenitiesReservationsRequest(filters: ReservationFilters) {
  return apiRequest<AmenityReservation[]>(
    `/reservas/amenidades?${buildReservationQuery(filters)}`,
  );
}

export function getAmenityAvailabilityRequest(idAmenidad: number, fecha: string) {
  return apiRequest<AmenityAvailabilityResponse>(
    `/reservas/amenidades/disponibilidad?${buildAvailabilityQuery(idAmenidad, fecha)}`,
  );
}

export function validateAmenityConflictRequest(payload: CreateAmenityReservationPayload) {
  return apiRequest<AmenityConflictResponse>(
    `/reservas/amenidades/conflicto?${buildConflictQuery(payload)}`,
  );
}

export function createAmenitiesReservationRequest(payload: CreateAmenityReservationPayload) {
  return apiRequest<AmenityReservation>("/reservas/amenidades", {
    method: "POST",
    body: payload,
  });
}

export function getAdminAmenitiesRequest() {
  return apiRequest<Amenity[]>("/admin/amenidades");
}

export function getAdminAmenitiesUsersRequest() {
  return apiRequest<ReservableUserOption[]>("/admin/amenidades/usuarios");
}

export function updateAmenityScheduleRequest(
  idAmenidad: number,
  payload: UpdateAmenitySchedulePayload,
) {
  return apiRequest<Amenity>(`/admin/amenidades/${idAmenidad}/horario`, {
    method: "PUT",
    body: payload,
  });
}

export function getAdminAmenitiesReservationsRequest(filters: ReservationFilters) {
  return apiRequest<AmenityReservation[]>(
    `/admin/reservas/amenidades?${buildReservationQuery(filters)}`,
  );
}

export function getAdminAmenityAvailabilityRequest(idAmenidad: number, fecha: string) {
  return apiRequest<AmenityAvailabilityResponse>(
    `/admin/reservas/amenidades/disponibilidad?${buildAvailabilityQuery(idAmenidad, fecha)}`,
  );
}

export function validateAdminAmenityConflictRequest(payload: CreateAmenityReservationPayload) {
  return apiRequest<AmenityConflictResponse>(
    `/admin/reservas/amenidades/conflicto?${buildConflictQuery(payload)}`,
  );
}

export function createAdminAmenitiesReservationRequest(payload: CreateAmenityReservationPayload) {
  return apiRequest<AmenityReservation>("/admin/reservas/amenidades", {
    method: "POST",
    body: payload,
  });
}
