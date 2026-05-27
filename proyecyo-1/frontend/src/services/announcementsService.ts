import { apiRequest } from "@/services/api";
import type { AnnouncementPayload, AnnouncementRecord } from "@/types/announcements";

export function getAnnouncementsRequest() {
  return apiRequest<AnnouncementRecord[]>("/admin/comunicados");
}

export function sendAnnouncementRequest(payload: AnnouncementPayload) {
  return apiRequest<AnnouncementRecord>("/admin/comunicados", {
    method: "POST",
    body: payload,
  });
}
