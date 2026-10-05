import type { LucideIcon } from "lucide-react";

import type { UserRole } from "@/types/auth";

export type RoleNavItem<Badge extends string = string> = {
  label: string;
  icon: LucideIcon;
  to: string;
  /** Rutas adicionales (alias o subrutas) que marcan este item como activo. */
  matches?: string[];
  end?: boolean;
  badge?: Badge;
};

export type RoleNavSection<Badge extends string = string> = {
  title: string;
  items: RoleNavItem<Badge>[];
};

function matchesPath(pathname: string, target: string, end?: boolean) {
  if (pathname === target) return true;
  return !end && pathname.startsWith(`${target}/`);
}

export function isNavItemActive(item: RoleNavItem, pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (matchesPath(normalized, item.to, item.end)) return true;
  return (item.matches ?? []).some((path) => matchesPath(normalized, path));
}

export function findActiveNavItem<Badge extends string>(
  sections: RoleNavSection<Badge>[],
  extraItems: RoleNavItem<Badge>[],
  pathname: string,
) {
  const items = [...sections.flatMap((section) => section.items), ...extraItems];
  return items.find((item) => isNavItemActive(item, pathname)) ?? null;
}

/** Roles cuyo panel usa un layout con sidebar persistente (ver AppShell). */
export const rolesWithSidebar: ReadonlySet<UserRole> = new Set<UserRole>(["residente", "inquilino", "guardia"]);
