import { apiRequest } from "./api";
import type { LoginPayload, LoginResponse } from "@/types/auth";

export function loginRequest(payload: LoginPayload) {
  return apiRequest<LoginResponse>("/login", {
    method: "POST",
    body: payload,
  });
}