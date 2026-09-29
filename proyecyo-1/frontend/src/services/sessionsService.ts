import { apiRequest } from "@/services/api";
import type { ActiveSession, CloseSessionResponse } from "@/types/sessions";

export function getActiveSessionsRequest() {
  return apiRequest<ActiveSession[]>("/auth/sessions");
}

export function closeActiveSessionRequest(sessionId: string) {
  return apiRequest<CloseSessionResponse>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}
