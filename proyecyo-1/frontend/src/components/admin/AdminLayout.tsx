import type { ReactNode } from "react";
import {
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  Settings,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/components/ui/utils";
import { useAuth } from "@/hooks/useAuth";

type AdminLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
};

type AdminMenuItem = {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  end?: boolean;
};

const adminMenuItems: AdminMenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/admin",
    end: true,
  },
  {
    label: "Accesos",
    icon: KeyRound,
    to: "/admin/accesos",
  },
  {
    label: "Pagos",
    icon: Wallet,
    to: "/admin/pagos",
  },
  {
    label: "Amenidades",
    icon: Home,
    to: "/admin/amenidades",
  },
  {
    label: "Reportes",
    icon: FileText,
    to: "/admin/reportes",
  },
  {
    label: "Configuraci\u00f3n",
    icon: Settings,
    to: "/admin/configuracion",
  },
];

function getInitials(email: string | undefined) {
  if (!email) {
    return "AD";
  }

  const [namePart] = email.split("@");
  return (namePart.slice(0, 2) || "ad").toUpperCase();
}

export function AdminLayout({ title, subtitle, children, actions }: AdminLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 px-8 py-10">
          <p className="text-[2.05rem] font-semibold leading-none tracking-tight text-blue-600">
            NexusResidencial
          </p>
          <p className="mt-3 text-[1.1rem] text-slate-500">Panel de Administraci\u00f3n</p>
        </div>

        <nav className="px-5 py-6 lg:px-5 lg:py-8">
          <div className="grid gap-2">
            {adminMenuItems.map(({ label, icon: Icon, to, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-4 rounded-2xl px-5 py-4 text-[1.05rem] font-medium transition",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                  )
                }
              >
                <Icon className="size-6 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mt-auto border-t border-slate-200 px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-600">
              {getInitials(user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[1.05rem] font-medium text-slate-950">Administrador</p>
              <p className="truncate text-sm text-slate-500">
                {user?.email || "admin@residencial.com"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:pl-[320px]">
        <div className="px-4 py-6 sm:px-8 lg:px-10 lg:py-12">
          <div className="mx-auto max-w-[1540px]">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-[3.15rem]">
                  {title}
                </h1>
                <p className="mt-3 text-lg text-slate-500">{subtitle}</p>
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </header>

            <div className="mt-10">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
