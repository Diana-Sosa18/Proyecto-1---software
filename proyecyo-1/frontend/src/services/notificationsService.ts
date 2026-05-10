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