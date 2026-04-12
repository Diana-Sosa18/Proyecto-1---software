import { apiRequest } from "@/services/api";
import type { FrequentVisitor, VisitPayload, VisitRecord } from "@/types/visits";

export function getVisitsRequest() {
  return apiRequest<VisitRecord[]>("/visitas");
}

export function getFrequentVisitorsRequest() {
  return apiRequest<FrequentVisitor[]>("/visitantes-frecuentes");
}

export function createVisitRequest(payload: VisitPayload) {
  return apiRequest<VisitRecord>("/visitas", {
    method: "POST",
    body: payload,
  });
}

export function deleteVisitRequest(id: number) {
  return apiRequest<VisitRecord>(`/visitas/${id}`, {
    method: "DELETE",
  });
}
