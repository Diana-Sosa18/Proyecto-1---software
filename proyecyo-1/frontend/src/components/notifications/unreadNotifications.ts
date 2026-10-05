import { useEffect, useState } from "react";

import { subscribeToSidebarCounters } from "@/components/layout/sidebarCounters";
import { getUnreadNotificationsRequest } from "@/services/notificationsService";

/**
 * Fuente unica del total de notificaciones no leidas del usuario.
 * Usa el conteo del backend (COUNT sobre todas las notificaciones), no el
 * listado de GET /notificaciones, que solo trae las 20 mas recientes.
 * La comparten el badge del sidebar y el KPI del dashboard.
 */
export function loadUnreadNotificationsCount() {
  return getUnreadNotificationsRequest().then((response) => response.unread);
}

export type UnreadCountState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: number };

/** Total de no leidas; se recarga cuando el sidebar recalcula sus contadores. */
export function useUnreadNotificationsCount() {
  const [state, setState] = useState<UnreadCountState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    function load() {
      loadUnreadNotificationsCount()
        .then((data) => {
          if (active) setState({ status: "ready", data });
        })
        .catch((error) => {
          if (active) {
            setState({
              status: "error",
              message: error instanceof Error && error.message ? error.message : "No fue posible contar los avisos.",
            });
          }
        });
    }

    load();
    const unsubscribe = subscribeToSidebarCounters(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
