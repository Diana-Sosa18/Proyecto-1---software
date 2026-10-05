import { useEffect, useState } from "react";

const SIDEBAR_COUNTERS_CHANGED_EVENT = "nexus:sidebar-counters-changed";

/** Avisa al sidebar que debe recalcular sus contadores (p. ej. al marcar avisos como leidos). */
export function notifySidebarCountersChanged() {
  window.dispatchEvent(new Event(SIDEBAR_COUNTERS_CHANGED_EVENT));
}

/** Suscribe un listener a los cambios de contadores; devuelve la funcion para desuscribir. */
export function subscribeToSidebarCounters(listener: () => void) {
  window.addEventListener(SIDEBAR_COUNTERS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SIDEBAR_COUNTERS_CHANGED_EVENT, listener);
}

export type SidebarCounters<Key extends string> = Partial<Record<Key, number>>;

/**
 * Carga contadores reales para los badges del sidebar. Si una consulta falla,
 * el badge simplemente no se muestra: nunca se inventa un valor.
 * `loaders` debe ser estable (definido a nivel de modulo).
 */
export function useSidebarCounters<Key extends string>(loaders: Record<Key, () => Promise<number>>) {
  const [counters, setCounters] = useState<SidebarCounters<Key>>({});

  useEffect(() => {
    let active = true;

    function load() {
      (Object.keys(loaders) as Key[]).forEach((key) => {
        loaders[key]()
          .then((value) => {
            if (active) setCounters((current) => ({ ...current, [key]: value }));
          })
          .catch(() => {
            if (active) setCounters((current) => ({ ...current, [key]: undefined }));
          });
      });
    }

    load();
    const unsubscribe = subscribeToSidebarCounters(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loaders]);

  return counters;
}

/** Dato secundario del pie del sidebar (p. ej. la unidad). Si falla, no se muestra. */
export function useSidebarDetail(loader: () => Promise<string | null>) {
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loader()
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [loader]);

  return detail;
}
