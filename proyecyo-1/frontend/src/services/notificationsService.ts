import { apiRequest } from "@/services/api";
import type { NotificationRecord, UnreadNotificationsResponse } from "@/types/notifications";

export function getNotificationsRequest() {
  return apiRequest<NotificationRecord[]>("/notificaciones");
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