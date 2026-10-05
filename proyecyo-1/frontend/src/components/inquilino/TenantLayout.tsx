import type { ReactNode } from "react";

import { RoleSidebarLayout, type RoleSidebarConfig } from "@/components/layout/RoleSidebarLayout";
import { useSidebarCounters, useSidebarDetail } from "@/components/layout/sidebarCounters";
import { loadUnreadNotificationsCount } from "@/components/notifications/unreadNotifications";
import {
  tenantNavSections,
  tenantSessionsItem,
  type TenantBadgeKey,
} from "@/components/inquilino/tenantNavigation";
import { getTenantAccountStatementRequest } from "@/services/tenantAccountService";

type TenantLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
};

const tenantSidebarConfig: RoleSidebarConfig<TenantBadgeKey> = {
  panelLabel: "Panel de Inquilino",
  roleLabel: "Inquilino",
  roleNoun: "inquilino",
  homePath: "/inquilino",
  sections: tenantNavSections,
  sessionsItem: tenantSessionsItem,
  counterLabels: { unreadNotifications: "sin leer" },
};

const tenantCounterLoaders: Record<TenantBadgeKey, () => Promise<number>> = {
  unreadNotifications: loadUnreadNotificationsCount,
};

// La unidad sale del estado de cuenta del inquilino; si no existe, no se muestra.
const loadTenantUnit = () =>
  getTenantAccountStatementRequest().then((response) => response.casa?.unidad ?? null);

/** Layout del panel de inquilino: solo expone modulos autorizados al inquilino. */
export function TenantLayout({ title, subtitle, children, actions }: TenantLayoutProps) {
  const counters = useSidebarCounters(tenantCounterLoaders);
  const unit = useSidebarDetail(loadTenantUnit);

  return (
    <RoleSidebarLayout
      config={tenantSidebarConfig}
      counters={counters}
      userDetail={unit ? `Unidad ${unit}` : null}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </RoleSidebarLayout>
  );
}
