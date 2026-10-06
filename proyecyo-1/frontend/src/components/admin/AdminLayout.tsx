import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  BellRing,
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldAlert,
  UserCheck,
  Wallet,
  BriefcaseBusiness,
  MessageSquareText,
  MonitorSmartphone,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

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
    label: "Usuarios autorizados",
    icon: UserCheck,
    to: "/admin/usuarios-autorizados",
  },
  {
    label: "Proveedores",
    icon: BriefcaseBusiness,
    to: "/admin/proveedores",
  },
  {
    label: "Accesos especiales",
    icon: ShieldAlert,
    to: "/admin/accesos-especiales",
  },
  {
    label: "Comunicados",
    icon: Megaphone,
    to: "/admin/comunicados",
  },
  {
    label: "Pagos",
    icon: Wallet,
    to: "/admin/pagos",
    end: true,
  },
  { label: "Reembolsos de pagos", icon: Wallet, to: "/admin/pagos/reembolsos" },
  { label: "Conciliación de pagos", icon: Wallet, to: "/admin/pagos/conciliacion" },
  {
    label: "Recordatorios",
    icon: BellRing,
    to: "/admin/recordatorios",
  },
  {
    label: "Sanciones",
    icon: ShieldAlert,
    to: "/admin/sanciones",
  },
  {
    label: "Historial sanciones",
    icon: FileText,
    to: "/admin/sanciones/historial-completo",
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
  {
    label: "Auditor\u00eda",
    icon: ShieldAlert,
    to: "/admin/auditoria",
  },
  {
    label: "Solicitudes demo",
    icon: MessageSquareText,
    to: "/admin/solicitudes-demo",
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
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  // HU32: en movil/tablet el menu es un panel desplegable; antes empujaba todo el
  // contenido debajo de ~19 enlaces. En escritorio (lg) el sidebar sigue fijo.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-none tracking-tight text-blue-600">NexusResidencial</p>
          <p className="mt-1 truncate text-xs text-slate-500">{"Panel de Administraci\u00f3n"}</p>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Cerrar men\u00fa" : "Abrir men\u00fa"}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          data-testid="admin-drawer-backdrop"
        />
      ) : null}

      <aside
        id={menuId}
        aria-label={"Navegaci\u00f3n del administrador"}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] max-w-[85vw] flex-col overflow-hidden border-r border-slate-200 bg-white transition-transform duration-200 lg:w-[232px] lg:translate-x-0",
          menuOpen ? "visible translate-x-0 shadow-xl" : "invisible -translate-x-full lg:visible",
        )}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-5">
          <p className="text-[1.34rem] font-semibold leading-none tracking-tight text-blue-600">
            NexusResidencial
          </p>
          <p className="mt-1.5 text-[0.78rem] text-slate-500">
            {"Panel de Administraci\u00f3n"}
          </p>
        </div>

        <nav aria-label={"M\u00f3dulos del administrador"} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:py-5">
          <div className="grid gap-1">
            {adminMenuItems.map(({ label, icon: Icon, to, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-medium transition",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
              {getInitials(user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.84rem] font-medium text-slate-950">Administrador</p>
              <p className="truncate text-[0.72rem] text-slate-500">
                {user?.email || "admin@residencial.com"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[0.84rem] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <LogOut className="size-4" />
            {"Cerrar sesi\u00f3n"}
          </button>
          <NavLink
            to="/cuenta/sesiones"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[0.84rem] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <MonitorSmartphone className="size-4" />
            Sesiones activas
          </NavLink>
        </div>
      </aside>

      <main className="lg:pl-[232px]">
        <div className="px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-[1240px]">
            <header className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[2.05rem]">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </header>

            <div className="mt-5">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
