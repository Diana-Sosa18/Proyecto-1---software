export type UserRole = "admin" | "guardia" | "residente" | "inquilino";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type LoginResponse = AuthUser;