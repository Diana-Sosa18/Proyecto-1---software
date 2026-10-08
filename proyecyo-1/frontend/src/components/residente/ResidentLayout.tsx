import type { ReactNode } from "react";

import { RoleSidebarLayout, type RoleSidebarConfig } from "@/components/layout/RoleSidebarLayout";
import { useResidentSidebarData } from "@/components/residente/residentBadges";
import {
  residentNavSections,
  residentSessionsItem,
  type ResidentBadgeKey,
} from "@/components/residente/residentNavigation";

type ResidentLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
};

const residentSidebarConfig: RoleSidebarConfig<ResidentBadgeKey> = {
  panelLabel: "Panel de Residente",
  roleLabel: "Residente",
  roleNoun: "residente",
  homePath: "/residente",
  accent: "#2563EB",
  sections: residentNavSections,
  sessionsItem: residentSessionsItem,
  counterLabels: { unreadNotifications: "sin leer", pendingProviders: "pendientes", pendingTenantRequests: "solicitudes pendientes" },
};

/** Layout del panel de residente: solo expone modulos del rol residente. */
export function ResidentLayout({ title, subtitle, children, actions }: ResidentLayoutProps) {
  const { badges, unit } = useResidentSidebarData();

  return (
    <RoleSidebarLayout
      config={residentSidebarConfig}
      counters={badges}
      userDetail={unit ? `Unidad ${unit}` : null}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </RoleSidebarLayout>
  );
}
