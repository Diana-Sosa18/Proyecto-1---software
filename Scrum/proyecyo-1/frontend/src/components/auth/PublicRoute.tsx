import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { rolePaths } from "@/routes/rolePaths";

export function PublicRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Preparando plataforma...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={rolePaths[user.role]} replace />;
  }

  return <Outlet />;
}
