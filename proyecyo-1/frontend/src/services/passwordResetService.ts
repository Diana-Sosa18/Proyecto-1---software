import { apiRequest } from "@/services/api";

export function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    body: { email },
  });
}

export function resetPasswordRequest(token: string, password: string) {
  return apiRequest<{ message: string }>("/auth/password/reset", {
    method: "POST",
    body: { token, password },
  });
}
