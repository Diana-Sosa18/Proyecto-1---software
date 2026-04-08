import type { UserRole } from "@/types/auth";

export const rolePaths: Record<UserRole, string> = {
  admin: "/admin",
  guardia: "/guardia",
  residente: "/residente",
  inquilino: "/inquilino",
};
