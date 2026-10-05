import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
  findActiveNavItem,
  isNavItemActive,
  type RoleNavItem,
  type RoleNavSection,
} from "@/components/layout/roleNavigation";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/hooks/useAuth";

export type RoleSidebarConfig<Badge extends string = string> = {
  /** Texto bajo la marca, p. ej. "Panel de Residente". */
  panelLabel: string;
  /** Nombre del rol en el pie del sidebar. */
  roleLabel: string;
  homePath: string;
  /** Sustantivo del rol para etiquetas accesibles, p. ej. "residente". */
  roleNoun: string;
  sections: RoleNavSection<Badge>[];
  sessionsItem: RoleNavItem<Badge>;
  counterLabels?: Partial<Record<Badge, string>>;
};

type RoleSidebarLayoutProps<Badge extends string> = {
  config: RoleSidebarConfig<Badge>;
  counters?: Partial<Record<Badge, number>>;
  /** Dato secundario del usuario (p. ej. "Unidad B-302"); se omite si no existe. */
  userDetail?: string | null;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function getInitials(email: string | undefined, fallback: string) {
  if (!email) return fallback;
  const [namePart] = email.split("@");
  return (namePart.slice(0, 2) || fallback).toUpperCase();
}

function NavBadge({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[0.7rem] font-semibold leading-none text-white"
      aria-label={`${value} ${label}`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Layout con sidebar compartido por los paneles de rol (mismo lenguaje visual
 * que AdminLayout). Cada rol aporta su propia configuracion de navegacion:
 * este componente no decide permisos; la autorizacion real sigue en
 * ProtectedRoute y en el backend.
 */
export function RoleSidebarLayout<Badge extends string>({
  config,
  counters = {},
  userDetail,
  title,
  subtitle,
  actions,
  children,
}: RoleSidebarLayoutProps<Badge>) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeItem = findActiveNavItem(config.sections, [config.sessionsItem], pathname);
  const sessionsActive = isNavItemActive(config.sessionsItem, pathname);
  const SessionsIcon = config.sessionsItem.icon;

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-none tracking-tight text-blue-600">NexusResidencial</p>
          <p className="mt-1 truncate text-xs text-slate-500">{activeItem?.label ?? config.panelLabel}</p>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          aria-label={drawerOpen ? "Cerrar menú" : "Abrir menú"}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50",
            focusRing,
          )}
        >
          {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-hidden="true"
          onClick={closeDrawer}
          data-testid="sidebar-drawer-backdrop"
        />
      ) : null}

      <aside
        id={drawerId}
        aria-label={`Navegación del ${config.roleNoun}`}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:w-[232px] lg:translate-x-0",
          drawerOpen ? "visible translate-x-0 shadow-xl" : "invisible -translate-x-full lg:visible",
        )}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-5">
          <Link
            to={config.homePath}
            onClick={closeDrawer}
            className={cn("text-[1.34rem] font-semibold leading-none tracking-tight text-blue-600", focusRing)}
          >
            NexusResidencial
          </Link>
          <p className="mt-1.5 text-[0.78rem] text-slate-500">{config.panelLabel}</p>
        </div>

        <nav aria-label={`Módulos del ${config.roleNoun}`} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {config.sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {section.title}
              </p>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const active = isNavItemActive(item, pathname);
                  const Icon = item.icon;
                  const badgeValue = item.badge ? counters[item.badge] : undefined;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={closeDrawer}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-medium transition",
                        focusRing,
                        active ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {badgeValue ? (
                        <NavBadge value={badgeValue} label={(item.badge && config.counterLabels?.[item.badge]) ?? ""} />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600"
              aria-hidden="true"
            >
              {getInitials(user?.email, config.roleLabel.slice(0, 2).toUpperCase())}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.84rem] font-medium text-slate-950">{config.roleLabel}</p>
              <p className="truncate text-[0.72rem] text-slate-500">{user?.email}</p>
              {userDetail ? <p className="truncate text-[0.72rem] text-slate-500">{userDetail}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[0.84rem] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",
              focusRing,
            )}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
          <Link
            to={config.sessionsItem.to}
            onClick={closeDrawer}
            aria-current={sessionsActive ? "page" : undefined}
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[0.84rem] font-medium transition",
              focusRing,
              sessionsActive
                ? "border-blue-200 bg-blue-50 text-blue-600"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            )}
          >
            <SessionsIcon className="size-4" aria-hidden="true" />
            {config.sessionsItem.label}
          </Link>
        </div>
      </aside>

      <main className="lg:pl-[232px]">
        <div className="px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-[1240px]">
            <header className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[2.05rem]">{title}</h1>
                <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </header>

            <div className="mt-5 space-y-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
