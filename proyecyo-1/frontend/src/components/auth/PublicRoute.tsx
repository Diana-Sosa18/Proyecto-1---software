import { Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export function PublicRoute() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Preparando plataforma...</p>
      </div>
    );
  }

  return <Outlet />;
}
