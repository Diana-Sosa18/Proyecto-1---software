import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { HouseRecord } from "@/types/houses";
import type { HouseMapLayout } from "@/utils/houseMapLayout";
import { LOT_DEPTH, LOT_WIDTH } from "@/utils/houseMapLayout";

// Port de la escena "Residencial Los Pinos · Elige tu lote" a Three.js r169.
// Mismo mundo (texturas procedurales, cielo, dia/noche, faroles, muro, parque,
// casa club, casas modernas, autos, marcador), pero los lotes salen de la BD
// (houseMapLayout) y la decoracion se genera alrededor de las manzanas reales.

export type SceneView = "3d" | "aerea";
export type SceneAmbient = "dia" | "noche";
export type HouseKind = "pino" | "jacaranda" | "ceiba";

export const STATUS_COLORS = { DISPONIBLE: "#2E9E68", OCUPADA: "#E09A2E", INACTIVA: "#98A1A8" } as const;
export const statusKey = (house: HouseRecord) => (!house.activo ? "INACTIVA" : house.estado);

// El modelo 3D se elige por el nombre del modelo en la BD; si no coincide, por su forma.
export function houseKind(house: HouseRecord): HouseKind {
  const name = (house.modelo || "").toLowerCase();
  if (name.includes("pino")) return "pino";
  if (name.includes("jacaranda")) return "jacaranda";
  if (name.includes("ceiba")) return "ceiba";
  if ((house.niveles ?? 1) <= 1) return "pino";
  return (house.habitaciones ?? 0) >= 4 ? "ceiba" : "jacaranda";
}

export interface ResidentialSceneOptions {
  reduceMotion: boolean;
  autoRotate: boolean;
  onHover: (house: HouseRecord | null, event: PointerEvent | null) => void;
  onPick: (house: HouseRecord) => void;
}

export interface ResidentialSceneApi {
  setLayout: (layout: HouseMapLayout) => void;
  setVisible: (visible: (house: HouseRecord) => boolean) => void;
  select: (id: number | null, fly: boolean) => void;
  closeUp: (id: number) => void;
  setView: (view: SceneView) => void;
  setAmbient: (ambient: SceneAmbient) => void;
  dispose: () => void;
}

type LotEntry = {
  house: HouseRecord;
  group: THREE.Group;
  border: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  materials: THREE.Material[];
  occupied: boolean;
  facesNorth: boolean;
  hidden: boolean;
};

const AMBIENTS = {
  dia: { arriba: "#5B98D6", abajo: "#DCE7EC", cieloHemi: "#DCEBFA", sueloHemi: "#5E6E4E", hemi: 0.85, sol: "#FFF1DC", intSol: 2.4, exp: 1.0, luces: 0 },
  noche: { arriba: "#040914", abajo: "#1C2640", cieloHemi: "#33466F", sueloHemi: "#0E120E", hemi: 0.32, sol: "#9FB6FF", intSol: 0.35, exp: 1.2, luces: 1 },
} as const;
// r155+ usa luces fisicas: x PI reproduce la intensidad "legacy" de la referencia (r128).
const LIGHT = Math.PI;

export function createResidentialScene(container: HTMLElement, options: ResidentialSceneOptions): ResidentialSceneApi {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const C = (hex: string) => new THREE.Color(hex);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1400);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); // lanza si no hay WebGL
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.36, minDistance: 7, maxDistance: 175,
    autoRotate: options.autoRotate && !options.reduceMotion, autoRotateSpeed: 0.35 });
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  /* ---------- Texturas procedurales (sin imagenes externas) ---------- */
  function canvasTexture(base: string, tones: string[], points: number, size = 256, maxP = 2.2) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    for (let i = 0; i < points; i++) {
      g.globalAlpha = 0.15 + rnd() * 0.45; g.fillStyle = tones[i % tones.length];
      const s = 0.6 + rnd() * maxP; g.fillRect(rnd() * size, rnd() * size, s, s);
    }
    g.globalAlpha = 1;
    return c;
  }
  function woodCanvas() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = ["#8C5E3C", "#7E5233", "#946543", "#85583A"][(x / 8) % 4]; g.fillRect(x, 0, 7, 128);
      g.fillStyle = "#3B2718"; g.fillRect(x + 7, 0, 1, 128);
    }
    return c;
  }
  const canvases = {
    pasto: canvasTexture("#6A9650", ["#5A8644", "#80AB62", "#4C773B", "#92B870"], 9000),
    asfalto: canvasTexture("#43484C", ["#33383B", "#52585C", "#5D6367"], 7000),
    concreto: canvasTexture("#CFCAC1", ["#BEB9AF", "#DAD6CE", "#B4AFA6"], 5000),
    madera: woodCanvas(),
  };
  const textures: THREE.Texture[] = [];
  function tex(name: keyof typeof canvases, rx: number, ry: number) {
    const t = new THREE.CanvasTexture(canvases[name]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    textures.push(t);
    return t;
  }

  /* ---------- Materiales compartidos ---------- */
  const M = {
    suelo: std({ map: tex("pasto", 70, 60), roughness: 1 }),
    jardin: std({ map: tex("pasto", 14, 12), color: C("#D8E8CF"), roughness: 1 }),
    linea: std({ color: C("#F2EFE6"), roughness: 0.8 }),
    muro: std({ color: C("#E6E2DA"), roughness: 0.9 }),
    seto: std({ color: C("#36592F"), roughness: 1 }),
    copas: ["#4E7B45", "#5E8C4C", "#3F6A3E", "#6C9455"].map((h) => std({ color: C(h), roughness: 1 })),
    cipres: std({ color: C("#2F4E2D"), roughness: 1 }),
    tronco: std({ color: C("#5B4636"), roughness: 1 }),
    metal: std({ color: C("#2A2E32"), roughness: 0.45, metalness: 0.6 }),
    lampara: std({ color: C("#FFF6E4"), emissive: C("#FFD49A"), emissiveIntensity: 0 }),
    agua: std({ color: C("#3AA6D8"), roughness: 0.05, metalness: 0.15, emissive: C("#23B2EA"), emissiveIntensity: 0 }),
    vidrio: std({ color: C("#1E2C34"), roughness: 0.06, metalness: 0.7, emissive: C("#FFB866"), emissiveIntensity: 0 }),
    madera: std({ map: tex("madera", 3, 1), roughness: 0.7 }),
    oscuro: std({ color: C("#2F3438"), roughness: 0.7 }),
    llanta: std({ color: C("#1A1C1E"), roughness: 0.9 }),
  };
  const asphalt = (w: number, d: number) => std({ map: tex("asfalto", w / 4, d / 4), roughness: 0.95 });
  const sidewalk = (w: number, d: number) => std({ map: tex("concreto", Math.max(w / 3, 0.5), Math.max(d / 3, 0.5)), roughness: 0.9 });

  /* ---------- Ayudantes (y = base del objeto) ---------- */
  function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function tree(x: number, z: number, s: number, parent: THREE.Object3D) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    if (rnd() < 0.28) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 3.2 * s, 9), M.cipres);
      cone.position.y = 1.8 * s; cone.castShadow = true; g.add(cone);
      return;
    }
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.5 * s, 6), M.tronco);
    t.position.y = 0.75 * s; t.castShadow = true; g.add(t);
    const mat = M.copas[Math.floor(rnd() * M.copas.length)];
    [[0, 2.1, 0, 1], [0.55, 1.85, 0.2, 0.7], [-0.45, 1.95, -0.25, 0.75], [0.1, 2.6, -0.1, 0.65]].forEach(([dx, dy, dz, r]) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), mat);
      b.position.set(dx * s, dy * s, dz * s); b.castShadow = true; g.add(b);
    });
    g.rotation.y = rnd() * Math.PI * 2;
  }

  /* ---------- Cielo y luces ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: { arriba: { value: new THREE.Color() }, abajo: { value: new THREE.Color() } },
    vertexShader: "varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }",
    fragmentShader: "uniform vec3 arriba; uniform vec3 abajo; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(abajo, arriba, smoothstep(0.0, 0.45, h)), 1.0); \n#include <colorspace_fragment>\n }",
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xffffff, 150, 420);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(-55, 85, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  /* ---------- Marcador de seleccion (anillo + pin) ---------- */
  const marker = new THREE.Group(); marker.visible = false; scene.add(marker);
  const markMat = std({ color: C("#FFFFFF"), emissive: C("#FFFFFF"), emissiveIntensity: 0.6, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.07, 8, 72), markMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35; marker.add(ring);
  const pin = new THREE.Group(); marker.add(pin);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), markMat); head.position.y = 1; pin.add(head);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 20), markMat); tip.rotation.x = Math.PI; tip.position.y = 0.45; pin.add(tip);
  pin.position.y = 5.2;

  let world = new THREE.Group();
  scene.add(world);
  let lots = new Map<number, LotEntry>();
  let pickables: THREE.Object3D[] = [];
  let streetLights: THREE.PointLight[] = [];
  let lampMats: THREE.MeshStandardMaterial[] = [];
  let ambient: SceneAmbient = "dia";
  let span = 100;
  let selected: LotEntry | null = null;
  let hover: LotEntry | null = null;

  /* ---------- Casas modernas (mismos tres modelos de la referencia) ---------- */
  const P = 1.45; // altura de un piso
  type LotMats = Record<"pared" | "madera" | "techo" | "oscuro" | "puerta" | "vidrio", THREE.Material>;
  function buildHouse(kind: HouseKind, L: LotMats, parent: THREE.Group) {
    const c = new THREE.Group(); c.position.z = -0.3; parent.add(c);
    const parts: THREE.Mesh[] = [];
    const add = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = box(w, h, d, mat, x, y, z, c); parts.push(m); return m; };
    let front: number, doorX: number;
    if (kind === "pino") {
      const w = 4.4, d = 4.2; front = d / 2; doorX = -0.4;
      add(w, P, d, L.pared, 0, 0, 0);
      add(1.4, P, 0.08, L.madera, -w / 2 + 0.7, 0, front + 0.04);
      add(w + 0.5, 0.16, d + 0.8, L.techo, 0, P, 0.25);
      add(1.9, 1.05, 0.05, L.vidrio, 1.05, 0.28, front + 0.03);
      add(0.55, 1.2, 0.06, L.puerta, -0.4, 0, front + 0.035);
      add(0.05, 0.75, 1.6, L.vidrio, w / 2 + 0.03, 0.5, -0.3);
    } else if (kind === "jacaranda") {
      const w = 4.2, d = 4.2; front = d / 2; doorX = -1.05;
      add(w, P, d, L.pared, 0, 0, 0);
      add(w, P, 3.9, L.oscuro, 0, P, 0.45);
      add(w + 0.2, 0.14, 4.25, L.techo, 0, 2 * P, 0.45);
      add(2.2, 1.15, 0.05, L.vidrio, 0.8, 0.2, front + 0.03);
      add(0.9, P, 0.06, L.madera, -1.65, 0, front + 0.03);
      add(0.55, 1.2, 0.06, L.puerta, -0.75, 0, front + 0.035);
      add(3.3, 0.55, 0.05, L.vidrio, 0.2, P + 0.5, 2.4 + 0.03);
      add(0.05, 0.6, 2, L.vidrio, w / 2 + 0.03, P + 0.5, 0.3);
    } else {
      front = 2.2; doorX = -1.95;
      add(3.6, P, 4.4, L.pared, 0.8, 0, 0);
      add(1.9, P, 3.4, L.pared, -1.95, 0, 0.5);
      add(1.6, 1.05, 0.06, L.oscuro, -1.95, 0, 2.23);
      add(5.6, P, 3.9, L.madera, -0.1, P, 0.35);
      add(5.9, 0.15, 4.25, L.techo, -0.1, 2 * P, 0.35);
      add(3.4, 0.8, 0.05, L.vidrio, 0.6, P + 0.32, 2.3 + 0.03);
      add(2.0, 1.15, 0.05, L.vidrio, 1.4, 0.2, 2.2 + 0.03);
      add(0.55, 1.2, 0.06, L.puerta, 0.05, 0, 2.23);
    }
    return { parts, front: front - 0.3, doorX };
  }
  const carColors = ["#E8E8E6", "#1F2326", "#8C1D24", "#3B5B7A", "#9CA3A8"];
  function car(parent: THREE.Group, x: number, z: number, color: string, mats: THREE.Material[]) {
    const g = new THREE.Group(); g.position.set(x, 0.05, z); parent.add(g);
    const body = std({ color: C(color), roughness: 0.3, metalness: 0.55 });
    const glass = M.vidrio.clone(); glass.emissiveIntensity = 0;
    const tire = M.llanta.clone();
    mats.push(body, glass, tire);
    box(0.78, 0.3, 1.65, body, 0, 0.12, 0, g);
    box(0.68, 0.26, 0.85, glass, 0, 0.42, -0.08, g);
    [[-0.37, 0.5], [0.37, 0.5], [-0.37, -0.52], [0.37, -0.52]].forEach(([wx, wz]) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 14), tire);
      r.rotation.z = Math.PI / 2; r.position.set(wx, 0.15, wz); g.add(r);
    });
  }
  function lamp(x: number, z: number, rot: number, parent: THREE.Object3D) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    box(0.1, 3, 0.1, M.metal, 0, 0, 0, g);
    box(1.1, 0.07, 0.12, M.metal, 0, 2.95, 0, g);
    [-0.5, 0.5].forEach((dx) => box(0.32, 0.06, 0.2, M.lampara, dx, 2.9, 0, g, false));
    const light = new THREE.PointLight(0xffc98a, 0, 14, 2);
    light.position.set(0, 2.7, 0); g.add(light); streetLights.push(light);
  }

  function disposeGroup(group: THREE.Object3D) {
    const shared = new Set<THREE.Material>([...Object.values(M).flat() as THREE.Material[]]);
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      mats.forEach((m) => { if (!shared.has(m)) { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); } });
    });
  }

  /* ---------- Residencial a partir del layout de la BD ---------- */
  function setLayout(layout: HouseMapLayout) {
    disposeGroup(world);
    scene.remove(world);
    world = new THREE.Group();
    scene.add(world);
    lots = new Map(); pickables = []; streetLights = []; lampMats = [];
    selected = null; hover = null; marker.visible = false;
    seed = 7;

    const { bounds } = layout;
    const ROAD = 4.5;
    const minX = bounds.minX - ROAD, maxX = bounds.maxX + ROAD, minZ = bounds.minZ - ROAD, maxZ = bounds.maxZ + ROAD;
    const parkW = 22, amenityD = 12;
    const siteMinX = minX - 1, siteMaxX = maxX + parkW, siteMinZ = minZ - 1, siteMaxZ = maxZ + amenityD;
    const cx = (siteMinX + siteMaxX) / 2, cz = (siteMinZ + siteMaxZ) / 2;
    span = Math.max(siteMaxX - siteMinX, siteMaxZ - siteMinZ, 40);
    const k = span / 100;

    // Terreno, calles y banquetas
    box(span * 4.2, 0.2, span * 3.4, M.suelo, cx, -0.2, cz, world, false);
    const roadsW = maxX - minX, roadsD = maxZ - minZ;
    box(roadsW, 0.05, roadsD, asphalt(roadsW, roadsD), (minX + maxX) / 2, 0, (minZ + maxZ) / 2, world, false);
    layout.blocks.forEach((b) => {
      const w = b.width + 1.2, d = b.depth + 1.2;
      box(w, 0.18, d, sidewalk(w, d), b.x + b.width / 2, 0, b.z + b.depth / 2, world, false);
    });
    // Lineas de carril: calles horizontales y entre columnas de manzanas
    layout.streetsZ.forEach((z) => { for (let x = minX + 1; x < maxX - 1; x += 2.6) box(1.2, 0.02, 0.12, M.linea, x, 0.05, z, world, false); });
    const gapsX = new Set<number>();
    layout.blocks.forEach((a) => layout.blocks.forEach((b) => {
      if (Math.abs(a.z - b.z) < 0.01 && b.x > a.x + a.width) gapsX.add(Math.round(((a.x + a.width + b.x) / 2) * 100) / 100);
    }));
    [minX + ROAD / 2, maxX - ROAD / 2, ...gapsX].forEach((x) => { for (let z = minZ + 1; z < maxZ - 1; z += 2.6) box(0.12, 0.02, 1.2, M.linea, x, 0.05, z, world, false); });

    // Muro perimetral con acceso al sur (garita)
    const H = 1.1, T = 0.3, gateX = (minX + maxX) / 2;
    const wallW = siteMaxX - siteMinX, wallD = siteMaxZ - siteMinZ;
    box(wallW, H, T, M.muro, cx, 0, siteMinZ, world);
    box(gateX - 3 - siteMinX, H, T, M.muro, (siteMinX + gateX - 3) / 2, 0, siteMaxZ, world);
    box(siteMaxX - gateX - 3, H, T, M.muro, (gateX + 3 + siteMaxX) / 2, 0, siteMaxZ, world);
    box(T, H, wallD, M.muro, siteMinX, 0, cz, world);
    box(T, H, wallD, M.muro, siteMaxX, 0, cz, world);

    // Faroles en las calles (limitados para no saturar la GPU)
    const lampSpots: Array<[number, number, number]> = [];
    layout.streetsZ.forEach((z) => { for (let x = minX + 6; x < maxX - 4; x += 16) lampSpots.push([x, z - 1.6, Math.PI / 2]); });
    lampSpots.slice(0, 14).forEach(([x, z, r]) => lamp(x, z, r, world));

    // Parque al este: banqueta, jardin, sendero, pergola y arboles
    const parkX = maxX + parkW / 2, parkD = Math.min(roadsD - 4, 26);
    box(parkW - 2, 0.16, parkD + 1.2, sidewalk(parkW - 2, parkD), parkX, 0, (minZ + maxZ) / 2, world, false);
    box(parkW - 3.2, 0.04, parkD, M.jardin, parkX, 0.16, (minZ + maxZ) / 2, world, false);
    for (let t = 0; t <= 1; t += 0.045) {
      const px = parkX - (parkW - 6) / 2 + (parkW - 6) * t, pz = (minZ + maxZ) / 2 + parkD * 0.35 - parkD * 0.7 * t + Math.sin(t * Math.PI * 2) * 2.2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), sidewalk(1, 1));
      p.position.set(px, 0.21, pz); p.receiveShadow = true; world.add(p);
    }
    const pergola = new THREE.Group(); pergola.position.set(parkX + 3, 0.2, (minZ + maxZ) / 2 - 2); world.add(pergola);
    [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]].forEach(([x, z]) => box(0.14, 2.2, 0.14, M.madera, x, 0, z, pergola));
    for (let x = -1.5; x <= 1.5; x += 0.3) box(0.08, 0.12, 2.4, M.madera, x, 2.2, 0, pergola);
    for (let i = 0; i < 7; i++) tree(parkX + (rnd() - 0.5) * (parkW - 6), (minZ + maxZ) / 2 + (rnd() - 0.5) * parkD, 0.8 + rnd() * 0.5, world);

    // Casa club con piscina y garita junto al acceso
    const deckZ = maxZ + amenityD / 2, deckW = Math.min(roadsW * 0.45, 30);
    const clubX = gateX - deckW / 2 - 4;
    box(deckW, 0.15, amenityD - 4, sidewalk(deckW, amenityD - 4), clubX, 0, deckZ, world, false);
    box(11, 1.8, 4.2, M.muro, clubX - deckW / 2 + 7, 0.15, deckZ - 0.3, world);
    box(9, 1.2, 0.05, M.vidrio, clubX - deckW / 2 + 7, 0.4, deckZ - 0.3 + 2.13, world);
    box(12, 0.18, 5.2, M.oscuro, clubX - deckW / 2 + 7, 1.95, deckZ + 0.1, world);
    box(9.4, 0.06, 3.6, M.agua, clubX + deckW / 2 - 7, 0.15, deckZ, world, false);
    [-3, -1.5, 0, 1.5].forEach((dx) => box(0.6, 0.15, 1.6, M.muro, clubX + deckW / 2 - 7 + dx, 0.15, deckZ - 2.6, world));
    box(2.6, 2.2, 2.6, M.muro, gateX + 5, 0, siteMaxZ - 2.5, world);
    box(2.2, 0.9, 0.05, M.vidrio, gateX + 5, 1, siteMaxZ - 2.5 + 1.31, world);
    box(3.2, 0.2, 3.2, M.oscuro, gateX + 5, 2.2, siteMaxZ - 2.5, world);
    box(5.4, 0.1, 0.1, M.lampara, gateX, 1, siteMaxZ - 0.6, world, false);

    // Arboles alrededor del residencial
    for (let i = 0; i < 140; i++) {
      const x = cx + (rnd() - 0.5) * span * 3, z = cz + (rnd() - 0.5) * span * 2.4;
      if (x > siteMinX - 2 && x < siteMaxX + 2 && z > siteMinZ - 2 && z < siteMaxZ + 2) continue;
      tree(x, z, 0.9 + rnd() * 0.8, world);
    }

    // Lotes (datos reales)
    layout.lots.forEach((lot) => {
      const house = lot.house;
      const g = new THREE.Group();
      g.position.set(lot.x, 0.18, lot.z);
      g.rotation.y = lot.facesNorth ? Math.PI : 0;
      world.add(g);
      const statusColor = C(STATUS_COLORS[statusKey(house)]);
      const L = {
        cesped: std({ map: tex("pasto", 2, 2.5), roughness: 1 }),
        borde: std({ color: statusColor, emissive: statusColor.clone(), emissiveIntensity: 0.45, roughness: 0.6 }),
        pared: M.muro.clone(), madera: M.madera.clone(), techo: M.oscuro.clone(), oscuro: M.oscuro.clone(),
        puerta: M.madera.clone(), vidrio: M.vidrio.clone(), concreto: sidewalk(1.4, 2), seto: M.seto.clone(), agua: M.agua.clone(),
      };
      L.techo.color = C("#3A3F44");
      const lw = LOT_WIDTH - 0.2, ld = LOT_DEPTH - 0.2;
      const lawn = box(lw, 0.05, ld, L.cesped, 0, 0, 0, g, false);
      const t = 0.14;
      [[lw, t, 0, ld / 2 - t / 2], [lw, t, 0, -ld / 2 + t / 2], [t, ld, lw / 2 - t / 2, 0], [t, ld, -lw / 2 + t / 2, 0]]
        .forEach(([bw, bd, bx, bz]) => box(bw, 0.07, bd, L.borde, bx, 0.02, bz, g, false));
      const kind = houseKind(house);
      const built = buildHouse(kind, L, g);
      const walk = ld / 2 - built.front - 0.15;
      box(1.4, 0.03, walk, L.concreto, built.doorX, 0.05, built.front + walk / 2, g, false);
      box(lw - 0.5, 0.5, 0.22, L.seto, 0, 0.05, -ld / 2 + 0.3, g);
      if (kind === "ceiba") {
        box(2.7, 0.03, 1.2, L.concreto, 0.7, 0.05, -ld / 2 + 1.15, g, false);
        box(2.3, 0.04, 0.85, L.agua, 0.7, 0.06, -ld / 2 + 1.15, g, false);
      } else {
        tree(lw / 2 - 0.8, -ld / 2 + 1, 0.5, g);
      }
      const carMats: THREE.Material[] = [];
      const occupied = house.estado === "OCUPADA";
      if (occupied) car(g, built.doorX, built.front + walk / 2 + 0.1, carColors[house.id_casa % carColors.length], carMats);
      const entry: LotEntry = {
        house, group: g, border: L.borde, glass: L.vidrio, water: L.agua,
        materials: [...Object.values(L), ...carMats], occupied, facesNorth: lot.facesNorth, hidden: false,
      };
      lots.set(house.id_casa, entry);
      [lawn, ...built.parts].forEach((m) => { m.userData.houseId = house.id_casa; pickables.push(m); });
    });

    Object.assign(sun.shadow.camera, { left: -span * 0.62, right: span * 0.62, top: span * 0.5, bottom: -span * 0.5, near: 20, far: 220 + span });
    sun.position.set(cx - 55 * k, 85 * Math.max(k, 0.8), cz + 45 * k);
    sun.target.position.set(cx, 0, cz);
    sun.shadow.camera.updateProjectionMatrix();
    controls.maxDistance = Math.max(175, span * 1.9);
    scene.fog = new THREE.Fog(0xffffff, span * 1.5, span * 4.2);
    lampMats = [M.lampara];
    applyAmbient(ambient);
    views.update(cx, cz, k);
    setView("3d");
  }

  /* ---------- Dia y noche ---------- */
  function applyAmbient(mode: SceneAmbient) {
    ambient = mode;
    const a = AMBIENTS[mode];
    (sky.material as THREE.ShaderMaterial).uniforms.arriba.value.set(a.arriba);
    (sky.material as THREE.ShaderMaterial).uniforms.abajo.value.set(a.abajo);
    (scene.fog as THREE.Fog).color.set(a.abajo);
    hemi.color.set(a.cieloHemi); hemi.groundColor.set(a.sueloHemi); hemi.intensity = a.hemi * LIGHT;
    sun.color.set(a.sol); sun.intensity = a.intSol * LIGHT;
    renderer.toneMappingExposure = a.exp;
    lampMats.forEach((m) => { m.emissiveIntensity = a.luces * 4; });
    M.agua.emissiveIntensity = M.vidrio.emissiveIntensity = a.luces * 1.2;
    streetLights.forEach((l) => { l.intensity = a.luces * 2.2 * LIGHT; });
    lots.forEach((l) => {
      l.glass.emissiveIntensity = l.occupied ? a.luces * 1.6 : 0;
      l.water.emissiveIntensity = a.luces * 0.7;
    });
  }

  /* ---------- Camara ---------- */
  const views = {
    "3d": [new THREE.Vector3(-40, 50, 70), new THREE.Vector3(0, 0, 4)],
    aerea: [new THREE.Vector3(0, 140, 0.01), new THREE.Vector3(0, 0, 4)],
    update(cx: number, cz: number, k: number) {
      this["3d"] = [new THREE.Vector3(cx - 40 * k, 50 * k, cz + 70 * k), new THREE.Vector3(cx, 0, cz)];
      this.aerea = [new THREE.Vector3(cx, 140 * k, cz + 0.01), new THREE.Vector3(cx, 0, cz)];
    },
  };
  let flight: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number } | null = null;
  function fly(pos: THREE.Vector3, target: THREE.Vector3) {
    if (options.reduceMotion) { camera.position.copy(pos); controls.target.copy(target); return; }
    flight = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone(), t: 0 };
  }
  function setView(view: SceneView) {
    const [pos, target] = views[view];
    fly(pos as THREE.Vector3, target as THREE.Vector3);
  }
  camera.position.set(-110, 150, 200);
  controls.target.set(0, 0, 4);

  /* ---------- Interaccion ---------- */
  const glow = (l: LotEntry | null) => { if (l) l.border.emissiveIntensity = l === hover || l === selected ? 1.4 : 0.45; };
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function lotAt(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    for (const hit of ray.intersectObjects(pickables, false)) {
      const entry = lots.get(hit.object.userData.houseId as number);
      if (entry && !entry.hidden) return entry;
    }
    return null;
  }
  let down: [number, number] | null = null;
  const onMove = (e: PointerEvent) => {
    const l = lotAt(e);
    if (l !== hover) { const prev = hover; hover = l; glow(prev); glow(l); }
    renderer.domElement.style.cursor = l ? "pointer" : "";
    options.onHover(l?.house ?? null, e);
  };
  const onLeave = () => { const prev = hover; hover = null; glow(prev); options.onHover(null, null); };
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; // fue un arrastre
    const l = lotAt(e);
    if (l) options.onPick(l.house);
  };
  const canvas = renderer.domElement;
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(container);
  resize();

  /* ---------- Bucle ---------- */
  const clock = new THREE.Clock();
  let frame = 0;
  const animate = () => {
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / 1.6);
      const t = flight.t;
      const e = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(flight.p0, flight.p1, e);
      controls.target.lerpVectors(flight.t0, flight.t1, e);
      if (flight.t >= 1) flight = null;
    }
    if (marker.visible && !options.reduceMotion) {
      pin.position.y = 5.2 + Math.sin(clock.elapsedTime * 2.4) * 0.3;
      pin.rotation.y += dt * 1.5;
      const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.04; ring.scale.set(s, s, 1);
    }
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return {
    setLayout,
    setVisible(visible) {
      lots.forEach((l) => {
        const show = visible(l.house);
        l.hidden = !show;
        l.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = show; });
        l.materials.forEach((m) => {
          // r152+: un material opaco compila con OPAQUE (alfa forzado a 1); al cambiar
          // "transparent" hay que recompilar o la opacidad se ignora y nada se atenua.
          if (m.transparent !== !show) { m.transparent = !show; m.needsUpdate = true; }
          m.opacity = show ? 1 : 0.12;
          m.depthWrite = show;
        });
      });
    },
    select(id, flyTo) {
      const prev = selected;
      selected = id != null ? lots.get(id) ?? null : null;
      glow(prev); glow(selected);
      marker.visible = Boolean(selected);
      if (!selected) return;
      controls.autoRotate = false;
      const p = selected.group.position;
      marker.position.set(p.x, 0, p.z);
      if (flyTo) {
        const target = new THREE.Vector3(p.x, 0, p.z);
        fly(target.clone().add(new THREE.Vector3(-14, 26, 30)), target);
      }
    },
    closeUp(id) {
      const l = lots.get(id);
      if (!l) return;
      controls.autoRotate = false;
      const dir = l.facesNorth ? -1 : 1;
      const p = l.group.position;
      fly(new THREE.Vector3(p.x + 4.5, 3.2, p.z + dir * 11), new THREE.Vector3(p.x, 1.4, p.z));
    },
    setView(view) { controls.autoRotate = false; setView(view); },
    setAmbient: applyAmbient,
    dispose() {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      controls.dispose();
      disposeGroup(scene);
      Object.values(M).flat().forEach((m) => (m as THREE.Material).dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
