import { BellRing, History, LayoutDashboard, MonitorSmartphone, ScanLine, Users } from "lucide-react";

import {
  type RoleNavItem,
  type RoleNavSection,
} from "@/components/layout/roleNavigation";

export type GuardBadgeKey = "unreadAlerts";

// Solo operaciones de garita autorizadas por requireGuard. El guardia no
// tiene modulos financieros ni administrativos.
export const guardNavSections: RoleNavSection<GuardBadgeKey>[] = [
  {
    title: "General",
    items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/guardia", end: true }],
  },
  {
    title: "Operación",
    items: [
      { label: "Control de acceso", icon: ScanLine, to: "/guardia/control" },
      { label: "Visitas recientes", icon: Users, to: "/guardia/visitas" },
      { label: "Historial de accesos", icon: History, to: "/guardia/historial" },
    ],
  },
  {
    title: "Seguridad",
    items: [{ label: "Alertas", icon: BellRing, to: "/guardia/alertas", badge: "unreadAlerts" }],
  },
];

export const guardSessionsItem: RoleNavItem<GuardBadgeKey> = {
  label: "Sesiones activas",
  icon: MonitorSmartphone,
  to: "/guardia/sesiones",
  matches: ["/cuenta/sesiones"],
};
