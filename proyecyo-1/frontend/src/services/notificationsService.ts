import { apiRequest } from "@/services/api";
import type { NotificationPage, NotificationPageFilter, NotificationRecord, UnreadNotificationsResponse } from "@/types/notifications";

export function getNotificationsRequest() {
  return apiRequest<NotificationRecord[]>("/notificaciones");
}

/** Pagina estable de avisos del usuario; los filtros se aplican en el backend. */
export function getNotificationsPageRequest(options: { filtro?: NotificationPageFilter; cursor?: string | null; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (options.filtro && options.filtro !== "TODOS") query.set("filtro", options.filtro);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", String(options.limit));
  const qs = query.toString();
  return apiRequest<NotificationPage>(qs ? `/notificaciones/pagina?${qs}` : "/notificaciones/pagina");
}

export function getUnreadNotificationsRequest() {
  return apiRequest<UnreadNotificationsResponse>("/notificaciones/no-leidas");
}

export function markNotificationAsReadRequest(id: number) {
  return apiRequest<NotificationRecord>(`/notificaciones/${id}/leida`, {
    method: "PATCH",
  });
}

export function markAllNotificationsAsReadRequest() {
  return apiRequest<UnreadNotificationsResponse>("/notificaciones/marcar-todas-leidas", {
    method: "PATCH",
  });
}

// SCRUM-179: Sistema de alertas para guardias
export function getGuardNotificationsRequest() {
  return apiRequest<NotificationRecord[]>("/guardia/notificaciones");
}

export function getGuardUnreadNotificationsRequest() {
  return apiRequest<UnreadNotificationsResponse>("/guardia/notificaciones/no-leidas");
}

export function markGuardNotificationAsReadRequest(id: number) {
  return apiRequest<NotificationRecord>(`/guardia/notificaciones/${id}/leida`, {
    method: "PATCH",
  });
}

export function markAllGuardNotificationsAsReadRequest() {
  return apiRequest<UnreadNotificationsResponse>("/guardia/notificaciones/marcar-todas-leidas", {
    method: "PATCH",
  });
}