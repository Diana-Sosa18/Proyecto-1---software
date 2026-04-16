import { apiRequest } from "@/services/api";
import type {
  Amenity,
  AmenityReservation,
  CreateAmenityReservationPayload,
} from "@/types/amenities";

export function getAmenitiesRequest() {
  return apiRequest<Amenity[]>("/amenidades");
}

export function getAmenitiesReservationsRequest(from: string, to: string) {
  const query = new URLSearchParams({ from, to }).toString();
  return apiRequest<AmenityReservation[]>(`/reservas/amenidades?${query}`);
}

export function createAmenitiesReservationRequest(payload: CreateAmenityReservationPayload) {
  return apiRequest<AmenityReservation>("/reservas/amenidades", {
    method: "POST",
    body: payload,
  });
}
