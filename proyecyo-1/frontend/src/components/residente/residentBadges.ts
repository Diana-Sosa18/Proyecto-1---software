import {
  notifySidebarCountersChanged,
  useSidebarCounters,
  useSidebarDetail,
  type SidebarCounters,
} from "@/components/layout/sidebarCounters";
import { loadUnreadNotificationsCount } from "@/components/notifications/unreadNotifications";
import type { ResidentBadgeKey } from "@/components/residente/residentNavigation";
import { getResidentAccountStatementRequest } from "@/services/accountService";
import { getOwnerProvidersRequest } from "@/services/providersService";

/** Avisa al sidebar que debe recalcular sus contadores (p. ej. al marcar avisos como leidos). */
export const notifyResidentBadgesChanged = notifySidebarCountersChanged;

export type ResidentBadges = SidebarCounters<ResidentBadgeKey>;

const residentCounterLoaders: Record<ResidentBadgeKey, () => Promise<number>> = {
  unreadNotifications: loadUnreadNotificationsCount,
  pendingProviders: () => getOwnerProvidersRequest({ status: "PENDIENTE" }).then((response) => response.length),
};

// La unidad solo se muestra si el backend la reporta en el estado de cuenta.
const loadResidentUnit = () =>
  getResidentAccountStatementRequest().then((response) => response.cuotas?.[0]?.casa_unidad ?? null);

/** Contadores reales y unidad para el sidebar del residente. */
export function useResidentSidebarData() {
  const badges = useSidebarCounters(residentCounterLoaders);
  const unit = useSidebarDetail(loadResidentUnit);
  return { badges, unit };
}
