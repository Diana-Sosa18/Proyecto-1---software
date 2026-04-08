import { apiRequest } from "@/services/api";
import type { UserFormValues, UserRecord, UserTypeOption } from "@/types/users";

export function getUsersRequest() {
  return apiRequest<UserRecord[]>("/usuarios");
}

export function getUserTypesRequest() {
  return apiRequest<UserTypeOption[]>("/tipos-usuario");
}

export function createUserRequest(payload: UserFormValues) {
  return apiRequest<UserRecord>("/usuarios", {
    method: "POST",
    body: {
      ...payload,
      id_tipo_usuario: Number(payload.id_tipo_usuario),
    },
  });
}

export function updateUserRequest(id: number, payload: UserFormValues) {
  return apiRequest<UserRecord>(`/usuarios/${id}`, {
    method: "PUT",
    body: {
      ...payload,
      id_tipo_usuario: Number(payload.id_tipo_usuario),
    },
  });
}

export function deleteUserRequest(id: number) {
  return apiRequest<UserRecord>(`/usuarios/${id}`, {
    method: "DELETE",
  });
}
