import type { ReactNode } from "react";

import { guardNavSections, guardSessionsItem, type GuardBadgeKey } from "@/components/guardia/guardNavigation";
import { RoleSidebarLayout, type RoleSidebarConfig } from "@/components/layout/RoleSidebarLayout";
import { useSidebarCounters } from "@/components/layout/sidebarCounters";
import { getGuardUnreadNotificationsRequest } from "@/services/notificationsService";

type GuardLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
};

const guardSidebarConfig: RoleSidebarConfig<GuardBadgeKey> = {
  panelLabel: "Panel de Guardia",
  roleLabel: "Guardia",
  roleNoun: "guardia",
  homePath: "/guardia",
  accent: "#047857",
  sections: guardNavSections,
  sessionsItem: guardSessionsItem,
  counterLabels: { unreadAlerts: "sin leer" },
};

const guardCounterLoaders: Record<GuardBadgeKey, () => Promise<number>> = {
  unreadAlerts: () => getGuardUnreadNotificationsRequest().then((response) => response.unread),
};

/** Layout del puesto de garita: solo expone operaciones autorizadas al guardia. */
export function GuardLayout({ title, subtitle, children, actions }: GuardLayoutProps) {
  const counters = useSidebarCounters(guardCounterLoaders);

  return (
    <RoleSidebarLayout
      config={guardSidebarConfig}
      counters={counters}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </RoleSidebarLayout>
  );
}
