import { useEffect, useRef, useState } from "react";

import type { HouseRecord } from "@/types/houses";
import type { HouseMapLayout } from "@/utils/houseMapLayout";
import { createResidentialScene, type ResidentialSceneApi, type SceneAmbient, type SceneView } from "./residentialScene";

export type MapView = SceneView;
export type { SceneAmbient };

export interface HouseMap3DProps {
  layout: HouseMapLayout;
  selectedId: number | null;
  isDimmed: (house: HouseRecord) => boolean;
  describe: (house: HouseRecord) => string;
  onSelect: (house: HouseRecord) => void;
  onFailure: (message: string) => void;
  view: MapView;
  ambient?: SceneAmbient;
  autoRotate?: boolean;
  // Cambia (id + contador) cuando se pide "Ver la casa de cerca".
  closeUp?: { id: number; n: number } | null;
  // Volar hacia la vivienda cuando se selecciona desde fuera del mapa (lista, buscador).
  flyOnSelect?: boolean;
}

// Envoltorio React del motor 3D (residentialScene.ts, port de "Los Pinos · Elige tu lote").
export default function HouseMap3D({
  layout, selectedId, isDimmed, describe, onSelect, onFailure, view, ambient = "dia", autoRotate = false, closeUp = null, flyOnSelect = false,
}: HouseMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ResidentialSceneApi | null>(null);
  const propsRef = useRef({ describe, onSelect });
  propsRef.current = { describe, onSelect };
  const pickedRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let api: ResidentialSceneApi;
    try {
      api = createResidentialScene(container, {
        reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
        autoRotate,
        onHover: (house, event) => {
          const tooltip = tooltipRef.current;
          if (!tooltip) return;
          if (!house || !event) { tooltip.dataset.show = "false"; return; }
          const rect = container.getBoundingClientRect();
          tooltip.textContent = propsRef.current.describe(house);
          tooltip.style.left = `${event.clientX - rect.left}px`;
          tooltip.style.top = `${event.clientY - rect.top}px`;
          tooltip.dataset.show = "true";
        },
        onPick: (house) => { pickedRef.current = house.id_casa; propsRef.current.onSelect(house); },
      });
    } catch {
      onFailure("El mapa 3D no pudo iniciar en este navegador. Prueba con Chrome, Edge o Safari actualizados.");
      return undefined;
    }
    sceneRef.current = api;
    setReady(true);
    return () => { api.dispose(); sceneRef.current = null; };
    // El motor se crea una sola vez; los cambios se aplican en los efectos siguientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const api = sceneRef.current;
    if (!ready || !api) return;
    api.setLayout(layout);
    api.setVisible((house) => !isDimmed(house));
    api.select(selectedId, false);
    // isDimmed/selectedId se aplican tambien en sus propios efectos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, ready]);

  useEffect(() => { if (ready) sceneRef.current?.setVisible((house) => !isDimmed(house)); }, [isDimmed, ready, layout]);
  useEffect(() => {
    if (!ready) return;
    // Seleccion hecha en el mapa: no se vuela. Desde fuera (lista/buscador): se vuela hacia ella.
    const fromMap = pickedRef.current === selectedId;
    sceneRef.current?.select(selectedId, flyOnSelect && !fromMap);
    pickedRef.current = null;
  }, [selectedId, ready, flyOnSelect]);
  useEffect(() => { if (ready) sceneRef.current?.setView(view); }, [view, ready]);
  useEffect(() => { if (ready) sceneRef.current?.setAmbient(ambient); }, [ambient, ready]);
  useEffect(() => { if (ready && closeUp) sceneRef.current?.closeUp(closeUp.id); }, [closeUp, ready]);

  return (
    <div ref={containerRef} className="absolute inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full" style={{ touchAction: "none" }}>
      <div
        ref={tooltipRef}
        role="presentation"
        data-show="false"
        className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-full bg-[#14201A] px-3 py-1.5 text-[0.84rem] font-medium text-white opacity-0 transition-opacity data-[show=true]:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}
