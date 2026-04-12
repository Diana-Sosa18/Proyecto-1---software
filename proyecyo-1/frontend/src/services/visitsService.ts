import { apiRequest } from "@/services/api";
import type {
  FrequentVisitor,
  GuardQrValidationPayload,
  VisitPayload,
  VisitRecord,
} from "@/types/visits";

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

export function getGuardVisitsRequest() {
  return apiRequest<VisitRecord[]>("/guardia/visitas");
}

export function validateQrRequest(payload: GuardQrValidationPayload) {
  return apiRequest<VisitRecord>("/guardia/validar-qr", {
    method: "POST",
    body: payload,
  });
}

export function registerQrEntryRequest(payload: GuardQrValidationPayload) {
  return apiRequest<VisitRecord>("/guardia/registrar-ingreso", {
    method: "POST",
    body: payload,
  });
}
