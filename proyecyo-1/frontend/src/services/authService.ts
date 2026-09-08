import { apiRequest } from "./api";
import type { LoginPayload, LoginResponse } from "@/types/auth";

export function loginRequest(payload: LoginPayload) {
  return apiRequest<LoginResponse>("/login", {
    method: "POST",
    body: payload,
  });
}

// Consulta el rol y estado actuales del usuario para refrescar sus permisos.
export function getSessionRequest() {
  return apiRequest<LoginResponse>("/auth/session");
}
