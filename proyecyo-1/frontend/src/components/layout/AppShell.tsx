import type { ReactNode } from "react";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { rolePaths } from "@/routes/rolePaths";
import type { UserRole } from "@/types/auth";

type AppShellProps = {
  role: UserRole;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  guardia: "Guardia",
  residente: "Residente",
  inquilino: "Inquilino",
};

export function AppShell({ role, title, subtitle, children }: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f8fafc_30%,#f8fafc_100%)]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-900 p-3 text-white">
              <Building2 className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">NexusResidencial</p>
              <h1 className="text-xl text-slate-900">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700 sm:flex">
              <ShieldCheck className="mr-2 size-4" />
              {roleLabels[role]}
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="size-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card className="border-slate-200 bg-slate-900 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Sesion activa</p>
              <p className="mt-3 text-lg">{roleLabels[user?.role ?? role]}</p>
              <p className="text-sm text-slate-300">{user?.email}</p>
              <p className="mt-4 rounded-full bg-white/10 px-3 py-2 text-sm">
                Rol: {roleLabels[role]}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3">
              {Object.entries(rolePaths).map(([currentRole, path]) => {
                const isCurrent = currentRole === role;

                return (
                  <NavLink
                    key={path}
                    to={path}
                    className={`mb-2 flex rounded-lg px-3 py-2 text-sm transition ${
                      isCurrent
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {roleLabels[currentRole as UserRole]}
                  </NavLink>
                );
              })}
              <p className="px-3 pt-2 text-xs text-slate-400">
                Las rutas estan protegidas y cada sesion entra solo a su panel.
              </p>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <div>
            <h2 className="text-3xl text-slate-900">{title}</h2>
            <p className="mt-2 text-slate-600">{subtitle}</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}