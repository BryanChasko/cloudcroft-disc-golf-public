// Virtual walkthrough (Babylon.js, matching the house engine): 1m DEM terrain
// draped with NAIP 2022, OSM trails, course pins, illustrative forest.
// Orbit + WASD walk + WebXR. Pano viewpoints unlock with the ground survey.
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import "@babylonjs/core/Meshes/instancedMesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.js";
import { COURSES, PANOS } from "./config";
import type { CourseId, PanoView } from "./config";
import { mountPanoViewer } from "./pano-viewer";
import "./pano-viewer.css";
import "./walk.css";

// ---------- helpers ----------
const statusEl = document.getElementById("walk-status") as HTMLElement;
function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

const overlay = document.getElementById("error-overlay") as HTMLElement;
function showError(msg: string): void {
  overlay.hidden = false;
  overlay.textContent = msg;
}
window.addEventListener("error", (e) => showError(`error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) =>
  showError(`error: ${String(e.reason)}`),
);

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GridFile {
  bbox: [number, number, number, number];
  size: number;
  elev: number[][];
}

interface TrailsFile {
  features: {
    geometry: { type: string; coordinates: number[][] };
    properties: { kind: string; name: string };
  }[];
}

// World: 1 unit = 5 m. Origin at grid bbox center, north = -z.
const UNIT_M = 5;
const M_PER_DEG_LAT = 111320;

// ---------- boot ----------
async function main(): Promise<void> {
  setStatus("loading terrain…");
  const [grid, trailsData] = await Promise.all([
    fetch("data/dem/course-area-grid.json").then(
      (r) => r.json() as Promise<GridFile>,
    ),
    fetch("data/osm/trails.geojson").then(
      (r) => r.json() as Promise<TrailsFile>,
    ),
  ]);
  const [minLon, minLat, maxLon, maxLat] = grid.bbox;
  const n = grid.size;
  const midLat = (minLat + maxLat) / 2;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  const cLon = (minLon + maxLon) / 2;
  const cLat = (minLat + maxLat) / 2;
  const widthU = ((maxLon - minLon) * mPerDegLon) / UNIT_M;
  const depthU = ((maxLat - minLat) * M_PER_DEG_LAT) / UNIT_M;

  let minElev = Infinity;
  for (const row of grid.elev)
    for (const v of row) minElev = Math.min(minElev, v);

  const toWorld = (lon: number, lat: number): [number, number] => [
    ((lon - cLon) * mPerDegLon) / UNIT_M,
    (-(lat - cLat) * M_PER_DEG_LAT) / UNIT_M,
  ];

  function heightAt(lon: number, lat: number): number {
    const fx = ((lon - minLon) / (maxLon - minLon)) * (n - 1);
    const fy = ((maxLat - lat) / (maxLat - minLat)) * (n - 1);
    const x0 = Math.max(0, Math.min(n - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(n - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const ty = Math.max(0, Math.min(1, fy - y0));
    const a = grid.elev[y0][x0];
    const b = grid.elev[y0][x0 + 1];
    const c2 = grid.elev[y0 + 1][x0];
    const d = grid.elev[y0 + 1][x0 + 1];
    return (
      (a * (1 - tx) * (1 - ty) +
        b * tx * (1 - ty) +
        c2 * (1 - tx) * ty +
        d * tx * ty -
        minElev) /
      UNIT_M
    );
  }

  const inBounds = (lon: number, lat: number): boolean =>
    lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;

  // ---------- engine / scene ----------
  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.75, 0.84, 0.89, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 350;
  scene.fogEnd = 1200;
  scene.fogColor = new Color3(0.81, 0.86, 0.89);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.diffuse = new Color3(0.74, 0.83, 0.9);
  hemi.groundColor = new Color3(0.33, 0.41, 0.29);
  hemi.intensity = 0.9;
  const sun = new DirectionalLight(
    "sun",
    new Vector3(-0.55, -0.75, -0.33),
    scene,
  );
  sun.diffuse = new Color3(1, 0.95, 0.87);
  sun.intensity = 1.6;
  sun.position = new Vector3(300, 420, 180);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.0002;
  shadows.normalBias = 0.6;

  // Ground skirt far below the terrain edge.
  const skirt = MeshBuilder.CreateDisc(
    "skirt",
    { radius: 4000, tessellation: 48 },
    scene,
  );
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = -30;
  const skirtMat = new StandardMaterial("skirtMat", scene);
  // NOTE: unlit emissive response crushes darks on this pipeline
  // (measured: 0.23 specified renders ~12/255), so specify display
  // values directly. Warm tan plinth + sage skirt.
  skirtMat.emissiveColor = new Color3(0.45, 0.5, 0.44);
  skirtMat.disableLighting = true;
  skirt.material = skirtMat;

  // ---------- terrain ----------
  const naipTex = new Texture("data/naip/course-area-naip.jpg", scene);
  naipTex.gammaSpace = true;
  naipTex.anisotropicFilteringLevel = engine.getCaps().maxAnisotropy;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const lon = minLon + ((maxLon - minLon) * col) / (n - 1);
      const lat = maxLat - ((maxLat - minLat) * row) / (n - 1);
      const [x, z] = toWorld(lon, lat);
      positions.push(x, (grid.elev[row][col] - minElev) / UNIT_M, z);
      uvs.push(col / (n - 1), 1 - row / (n - 1));
    }
  }
  const tIndex: number[] = [];
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const a = row * n + col;
      const b = a + 1;
      const c2 = a + n;
      const d = c2 + 1;
      tIndex.push(a, b, c2, b, d, c2);
    }
  }
  const terrainVD = new VertexData();
  terrainVD.positions = positions;
  terrainVD.uvs = uvs;
  terrainVD.indices = tIndex;
  const terrainNormals: number[] = [];
  VertexData.ComputeNormals(positions, tIndex, terrainNormals);
  terrainVD.normals = terrainNormals;
  const terrain = new Mesh("terrain", scene);
  terrainVD.applyToMesh(terrain);
  const terrainMat = new StandardMaterial("terrainMat", scene);
  terrainMat.diffuseTexture = naipTex;
  terrainMat.specularColor = Color3.Black();
  terrain.material = terrainMat;
  terrain.receiveShadows = true;

  // Diorama plinth: vertical curtain sealing the terrain edge down to the
  // skirt, so grazing orbit angles never read a floating slab lip.
  const perim: number[] = [];
  for (let col = 0; col < n; col++) perim.push(col);
  for (let row = 1; row < n; row++) perim.push(row * n + (n - 1));
  for (let col = n - 2; col >= 0; col--) perim.push((n - 1) * n + col);
  for (let row = n - 2; row >= 1; row--) perim.push(row * n);
  const cPos: number[] = [];
  const cIdx: number[] = [];
  perim.forEach((vi, k) => {
    const vx = positions[vi * 3];
    const vy = positions[vi * 3 + 1];
    const vz = positions[vi * 3 + 2];
    cPos.push(vx, vy + 0.15, vz, vx, -30, vz);
    const a = k * 2;
    const b = ((k + 1) % perim.length) * 2;
    cIdx.push(a, b, a + 1, b, b + 1, a + 1);
  });
  const curtainVD = new VertexData();
  curtainVD.positions = cPos;
  curtainVD.indices = cIdx;
  const curtainNormals: number[] = [];
  VertexData.ComputeNormals(cPos, cIdx, curtainNormals);
  curtainVD.normals = curtainNormals;
  const curtain = new Mesh("curtain", scene);
  curtainVD.applyToMesh(curtain);
  const curtainMat = new StandardMaterial("curtainMat", scene);
  curtainMat.emissiveColor = new Color3(0.42, 0.33, 0.25);
  curtainMat.disableLighting = true;
  curtainMat.backFaceCulling = false;
  curtain.material = curtainMat;

  // ---------- trails (crisp line overlays; ribbons proved unrasterizable here) ----------
  const trailLines: Vector3[][] = [];
  for (const f of trailsData.features) {
    if (f.properties.kind !== "trail" || f.geometry.type !== "LineString")
      continue;
    let line: Vector3[] = [];
    const flush = (): void => {
      if (line.length > 1) trailLines.push(line);
      line = [];
    };
    for (const [lon, lat] of f.geometry.coordinates) {
      if (!inBounds(lon, lat)) {
        flush();
        continue;
      }
      const [x, z] = toWorld(lon, lat);
      line.push(new Vector3(x, heightAt(lon, lat) + 0.3, z));
    }
    flush();
  }
  const trailsMesh = MeshBuilder.CreateLineSystem(
    "trails",
    { lines: trailLines },
    scene,
  );
  trailsMesh.color = new Color3(1.0, 0.62, 0.15);

  // ---------- forest (instanced, illustrative) ----------
  const rand = mulberry32(1337);
  const TREE_COUNT = 1200;
  const pinPts = Object.values(COURSES).map((c) => toWorld(c.lon, c.lat));
  const sockPts: [number, number][] = Object.values(COURSES).map((c) => {
    const [sx, sz] = toWorld(c.lon, c.lat);
    return [sx + 2.2, sz];
  });
  const anchorPts = Object.values(COURSES).flatMap((c) => {
    const [x, z] = toWorld(c.lon, c.lat);
    return [
      [x, z],
      [x + 2.2, z],
      [x + 3, z + 12],
    ];
  });
  const trunkBase = MeshBuilder.CreateCylinder(
    "trunk",
    { diameterTop: 0.18, diameterBottom: 0.28, height: 1.4, tessellation: 5 },
    scene,
  );
  trunkBase.isVisible = false;
  const trunkMat = new StandardMaterial("trunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.35, 0.25, 0.19);
  trunkMat.specularColor = Color3.Black();
  trunkBase.material = trunkMat;
  const crownGreens = [
    new Color3(0.18, 0.36, 0.2),
    new Color3(0.23, 0.42, 0.23),
    new Color3(0.15, 0.3, 0.17),
  ];
  const crownMats: StandardMaterial[] = [];
  const crownBases = crownGreens.map((g, gi) => {
    const m = MeshBuilder.CreateCylinder(
      `crown${gi}`,
      { diameterTop: 0, diameterBottom: 2.0, height: 2.8, tessellation: 7 },
      scene,
    );
    m.isVisible = false;
    const mat = new StandardMaterial(`crownMat${gi}`, scene);
    mat.diffuseColor = g;
    mat.specularColor = Color3.Black();
    m.material = mat;
    crownMats.push(mat);
    return m;
  });
  // Blob shadow grounding each trunk (the sun shadow map's normal bias
  // washes out contact detail, so instances carry their own).
  const blobBase = MeshBuilder.CreateDisc(
    "blob",
    { radius: 1.5, tessellation: 20 },
    scene,
  );
  blobBase.isVisible = false;
  const blobMat = new StandardMaterial("blobMat", scene);
  blobMat.diffuseColor = Color3.Black();
  blobMat.alpha = 0.42;
  blobMat.disableLighting = true;
  blobMat.backFaceCulling = false;
  blobBase.material = blobMat;
  const placed: { x: number; y: number; z: number; s: number; r: number }[] =
    [];
  for (let i = 0; i < TREE_COUNT; i++) {
    let lon = cLon;
    let lat = cLat;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 20; tries++) {
      lon = minLon + (maxLon - minLon) * (0.02 + rand() * 0.96);
      lat = minLat + (maxLat - minLat) * (0.02 + rand() * 0.96);
      [x, z] = toWorld(lon, lat);
      if (anchorPts.every(([ax, az]) => Math.hypot(x - ax, z - az) > 4)) break;
    }
    placed.push({
      x,
      y: heightAt(lon, lat),
      z,
      s: 0.7 + rand() * 0.7,
      r: rand() * Math.PI * 2,
    });
  }
  const forest = new Mesh("forest", scene);
  // No trunk on the pad: keep every 360° photo spot clear so the first
  // thing a pano shows is the course, not bark. (Applies to orbit too —
  // pads read as groomed clearings.)
  const panoClear: [number, number][] = PANOS.map((p) => toWorld(p.lon, p.lat));
  const placedKept = placed.filter(({ x, z }) =>
    panoClear.every(([ax, az]) => Math.hypot(x - ax, z - az) > 12),
  );
  // Pads stay groomed: no trunk inside any 360° clearing.
  placedKept.forEach((t, i) => {
    const trunk = trunkBase.createInstance(`trunk${i}`);
    trunk.position.set(t.x, t.y + 0.7 * t.s, t.z);
    trunk.scaling.setAll(t.s);
    trunk.rotation.y = t.r;
    trunk.parent = forest;
    // Layered canopy: three stacked cones read as a pine, one cone reads
    // as a traffic pylon. Same instanced base, decreasing scale.
    const tiers: [number, number][] = [
      [2.2, 1.0],
      [3.3, 0.7],
      [4.2, 0.45],
    ];
    tiers.forEach(([dy, sc], ti) => {
      const crown = crownBases[i % 3].createInstance(`crown${i}-${ti}`);
      crown.position.set(t.x, t.y + dy * t.s, t.z);
      crown.scaling.setAll(t.s * sc);
      crown.rotation.y = t.r + ti * 0.3;
      crown.parent = forest;
    });
    const blob = blobBase.createInstance(`blob${i}`);
    blob.position.set(t.x, t.y + 0.12, t.z);
    // NOTE: rotate the instance, not the base: a rotated base bakes its
    // rotation into every instance's world matrix and scatters them.
    blob.rotation.x = -Math.PI / 2;
    blob.scaling.setAll(t.s);
    blob.parent = forest;
  });
  shadows.addShadowCaster(trunkBase);
  for (const c of crownBases) shadows.addShadowCaster(c);

  // ---------- course pins + windsocks ----------
  const PIN_COLORS: Record<CourseId, Color3> = {
    tiki: new Color3(0.12, 0.36, 0.25),
    community: new Color3(0.48, 0.29, 0.12),
  };
  const clickables: Mesh[] = [];
  const windsocks: Mesh[] = [];
  const labels: Mesh[] = [];
  for (const [id, c] of Object.entries(COURSES) as [
    CourseId,
    (typeof COURSES)[CourseId],
  ][]) {
    const [x, z] = toWorld(c.lon, c.lat);
    const y = heightAt(c.lon, c.lat);
    const pole = MeshBuilder.CreateCylinder(
      id + "-pole",
      { diameter: 0.14, height: 3.2 },
      scene,
    );
    pole.position.set(x, y + 1.6, z);
    const poleMat = new StandardMaterial(id + "-poleMat", scene);
    poleMat.diffuseColor = new Color3(0.23, 0.25, 0.23);
    pole.material = poleMat;
    const basket = MeshBuilder.CreateCylinder(
      id + "-basket",
      { diameterTop: 1.2, diameterBottom: 0.84, height: 0.4, tessellation: 12 },
      scene,
    );
    basket.position.set(x, y + 2.3, z);
    const basketMat = new StandardMaterial(id + "-basketMat", scene);
    basketMat.diffuseColor = new Color3(0.85, 0.33, 0.12);
    basket.material = basketMat;
    basket.metadata = { courseId: id };
    const ring = MeshBuilder.CreateTorus(
      id + "-ring",
      { diameter: 2.6, thickness: 0.35, tessellation: 32 },
      scene,
    );
    // NOTE: Babylon tori already lie flat (axis = Y); no rotation needed.
    ring.position.set(x, y + 0.15, z);
    const ringMat = new StandardMaterial(id + "-ringMat", scene);
    ringMat.emissiveColor = PIN_COLORS[id];
    ringMat.disableLighting = true;
    ring.material = ringMat;
    shadows.addShadowCaster(pole);
    shadows.addShadowCaster(basket);

    // Label billboard.
    const labelTex = new DynamicTexture(
      id + "-label",
      { width: 512, height: 128 },
      scene,
      true,
    );
    const ctx = labelTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "rgba(16, 20, 15, 0.78)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 116, 18);
    ctx.fill();
    ctx.fillStyle = "#f7f5ef";
    ctx.font =
      id === "tiki"
        ? "600 44px system-ui, sans-serif"
        : "600 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      id === "tiki" ? "Byron Ligon" : "Cloudcroft Community",
      256,
      58,
    );
    ctx.font = "400 32px system-ui, sans-serif";
    ctx.fillStyle = "#cfd6c9";
    ctx.fillText(
      id === "tiki" ? "9 holes · par 27" : "18 holes · par 63",
      256,
      100,
    );
    labelTex.update();
    labelTex.hasAlpha = true;
    const label = MeshBuilder.CreatePlane(
      id + "-labelPlane",
      { width: 18, height: 4.5 },
      scene,
    );
    const labelMat = new StandardMaterial(id + "-labelMat", scene);
    labelMat.diffuseTexture = labelTex;
    labelMat.emissiveColor = new Color3(1, 1, 1);
    labelMat.disableLighting = true;
    label.material = labelMat;
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    // Anchored above the tallest canopy (max tree top ~y+6) so low orbit
    // angles never swallow the text. Off-screen hiding (below) keeps edge
    // clipping clean instead of drawing through depth.
    label.position.set(x, y + 8.5, z);
    labels.push(label);

    const sockPole = MeshBuilder.CreateCylinder(
      id + "-sockPole",
      { diameter: 0.1, height: 4.2 },
      scene,
    );
    sockPole.position.set(x + 2.2, y + 2.1, z);
    const sock = MeshBuilder.CreateCylinder(
      id + "-sock",
      { diameterTop: 0, diameterBottom: 0.7, height: 1.6, tessellation: 8 },
      scene,
    );
    sock.rotation.z = -Math.PI / 2;
    sock.position.set(x + 2.2, y + 4.3, z);
    const sockMat = new StandardMaterial(id + "-sockMat", scene);
    sockMat.diffuseColor = new Color3(0.91, 0.63, 0.24);
    sock.material = sockMat;
    windsocks.push(sock);
    clickables.push(basket);
  }

  // ---------- surveyed pins: every Nov 1 ground-truth point ----------
  interface HoleFeature {
    geometry: { type: string; coordinates: number[] | number[][] };
    properties: {
      kind: string;
      hole?: number;
      survey_id?: string;
      name?: string;
      note?: string;
      lat?: number;
      lon?: number;
      photo?: string | null;
      photos_web?: string[];
      field_photos?: { web_url: string; label: string; dist_m: number }[];
      elevation_m?: number;
      accuracy_h_m?: number;
    };
  }
  interface HolesFile2 {
    features?: HoleFeature[];
  }
  const pinCard = document.getElementById("pin-card") as HTMLElement | null;
  // All surveyed pins, cached for the mountaintop jump + pin clicks.
  let pinFeats: HoleFeature[] = [];
  function showPinCard(p: HoleFeature["properties"]): void {
    if (!pinCard) return;
    const title = document.getElementById("pin-title");
    const text = document.getElementById("pin-text");
    const coords = document.getElementById("pin-coords");
    const img = document.getElementById("pin-photo") as HTMLImageElement | null;
    if (title) title.textContent = p.name ?? "survey point";
    if (text) {
      const bits = [p.kind, p.note].filter(Boolean).join(" — ");
      text.textContent =
        bits || "Located November 1 — label lands with the next field day.";
    }
    if (coords) {
      const meta: string[] = [];
      if (typeof p.lat === "number" && typeof p.lon === "number")
        meta.push(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`);
      if (typeof p.elevation_m === "number")
        meta.push(`elev ${p.elevation_m.toFixed(1)} m`);
      if (typeof p.accuracy_h_m === "number") meta.push(`±${p.accuracy_h_m} m`);
      coords.textContent = meta.join(" · ");
    }
    // Every photo at the pin: attached survey shot + nearest field photos.
    let strip = document.getElementById("pin-photos") as HTMLElement | null;
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "pin-photos";
      strip.className = "pin-photos";
      pinCard.insertBefore(strip, pinCard.querySelector("#pin-text"));
    }
    const shots: { src: string; label: string }[] = [
      ...(p.photos_web ?? []).map((src) => ({
        src,
        label: `Survey photo at ${p.name ?? "survey point"}`,
      })),
      ...(p.field_photos ?? []).map((f) => ({
        src: f.web_url,
        label: f.label,
      })),
    ];
    const seen = new Set<string>();
    strip.innerHTML = "";
    for (const s of shots) {
      if (seen.has(s.src)) continue;
      seen.add(s.src);
      const el = document.createElement("img");
      el.src = s.src;
      el.alt = s.label;
      el.loading = "lazy";
      strip.appendChild(el);
    }
    strip.hidden = shots.length === 0;
    if (img) {
      // Legacy single-photo slot kept for the first shot (deep-link
      // targets and older styles); hidden when the strip carries photos.
      if (shots.length > 0) {
        img.hidden = true;
        img.removeAttribute("src");
      } else if (p.photo) {
        img.src = p.photo;
        img.alt = `Field photo at ${p.name ?? "survey point"}`;
        img.hidden = false;
      } else {
        img.hidden = true;
        img.removeAttribute("src");
      }
    }
    pinCard.hidden = false;
  }
  async function holePins(): Promise<void> {
    const files = await Promise.all(
      Object.values(COURSES).map(
        async (c) => (await (await fetch(c.holesUrl)).json()) as HolesFile2,
      ),
    );
    const feats = files.flatMap((d) => d.features ?? []);
    pinFeats = feats;
    const teeMat = new StandardMaterial("teeMat", scene);
    teeMat.diffuseColor = new Color3(0.1, 0.32, 0.46);
    teeMat.emissiveColor = new Color3(0.04, 0.12, 0.2);
    const basketMat2 = new StandardMaterial("basketMat2", scene);
    basketMat2.diffuseColor = new Color3(0.72, 0.57, 0.04);
    basketMat2.emissiveColor = new Color3(0.2, 0.15, 0.01);
    const unknownMat = new StandardMaterial("surveyMat", scene);
    unknownMat.diffuseColor = new Color3(0.62, 0.62, 0.62);
    unknownMat.emissiveColor = new Color3(0.12, 0.12, 0.12);
    let pins = 0;
    for (const f of feats) {
      if (f.geometry.type !== "Point") continue;
      const [lon, lat] = f.geometry.coordinates as number[];
      const [x, z] = toWorld(lon, lat);
      const y = heightAt(lon, lat);
      const p = f.properties;
      const id = p.survey_id ?? `pin${pins}`;
      const m =
        p.kind === "basket"
          ? MeshBuilder.CreateCylinder(
              id,
              { diameterTop: 1.2, diameterBottom: 0.84, height: 0.4 },
              scene,
            )
          : MeshBuilder.CreateSphere(
              id,
              { diameter: p.kind === "tee" ? 1.2 : 0.7 },
              scene,
            );
      m.position.set(x, y + 1, z);
      m.material =
        p.kind === "tee"
          ? teeMat
          : p.kind === "basket"
            ? basketMat2
            : unknownMat;
      m.metadata = { survey: p };
      clickables.push(m as Mesh);
      panoOccluders.push(m as Mesh);
      pins++;
    }
    const lineMat = new StandardMaterial("fairwayLineMat", scene);
    lineMat.emissiveColor = new Color3(0.18, 0.49, 0.2);
    lineMat.disableLighting = true;
    for (const f of feats) {
      if (f.geometry.type === "LineString" && f.properties.kind === "fairway") {
        const coords = (f.geometry.coordinates as number[][]).map(
          ([lon, lat]) => {
            const [x, z] = toWorld(lon, lat);
            return new Vector3(x, heightAt(lon, lat) + 0.6, z);
          },
        );
        const line = MeshBuilder.CreateLines(
          "fairway",
          { points: coords },
          scene,
        );
        line.isVisible = true;
      }
    }
    setStatus(
      `${pins} survey pins from the November 1 field day — click any pin for its photo and coordinates`,
    );
    // holePins resolves after fetch: if a pano opened first, its pins
    // arrived late and visible — re-apply pano hiding to them.
    if (panoOpen) setPanoMode(true);
  }
  void holePins();

  // ---------- cameras ----------
  const tikiWorld = toWorld(COURSES.tiki.lon, COURSES.tiki.lat);
  const tikiY = heightAt(COURSES.tiki.lon, COURSES.tiki.lat);
  const orbitCam = new ArcRotateCamera(
    "orbit",
    Math.PI / 4,
    1.0,
    220,
    new Vector3(tikiWorld[0], tikiY, tikiWorld[1]),
    scene,
  );
  orbitCam.lowerRadiusLimit = 8;
  orbitCam.upperRadiusLimit = 900;
  orbitCam.upperBetaLimit = 1.43;
  orbitCam.attachControl(canvas, true);
  orbitCam.minZ = 0.5;
  orbitCam.maxZ = 4000;

  const walkCam = new UniversalCamera(
    "walk",
    new Vector3(tikiWorld[0] + 3, tikiY + 0.8, tikiWorld[1] + 12),
    scene,
  );
  walkCam.minZ = 0.1;
  walkCam.maxZ = 4000;
  walkCam.inputs.clear();

  let mode: "orbit" | "walk" = "orbit";
  let panoOpen = false;
  let yaw = Math.PI;
  let pitch = 0.08;
  const keys = new Set<string>();
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging || mode !== "walk") return;
    yaw -= (e.clientX - lastX) * 0.004;
    // Look-down clamps at -7°: the 1m aerial drape smears at grazing
    // angles, so the foreground band never fills the walk frame.
    pitch = Math.max(-0.12, Math.min(1.2, pitch - (e.clientY - lastY) * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("pointerup", () => (dragging = false));

  function applyWalkRotation(): void {
    walkCam.rotation.set(-pitch, yaw, 0);
  }

  function enterWalk(at: CourseId): void {
    mode = "walk";
    scene.activeCamera = walkCam;
    orbitCam.detachControl();
    const c = COURSES[at];
    const [x, z] = toWorld(c.lon, c.lat);
    // Offset east of the pin axis so walking forward clears the basket.
    walkCam.position.set(x + 3, heightAt(c.lon, c.lat) + 0.8, z + 12);
    yaw = Math.PI;
    pitch = 0.08;
    applyWalkRotation();
    setStatus(
      "First Person — drag to look, WASD/arrows to move, shift to hurry",
    );
  }

  // Meshes that block the 360° photo (forest + survey pins): hidden in
  // pano mode so the photo, not the illustrative geometry, is the view.
  const panoOccluders: Mesh[] = [];
  // Forest visibility rides a flag, not forest.isEnabled(): the container
  // mesh is always enabled (children carry the geometry), so reading the
  // container lied — once hidden, the toggle could never bring trees back.
  let forestOn =
    (
      document.getElementById("toggle-trees") as HTMLElement | null
    )?.classList.contains("active") ?? true;
  function treesWanted(): boolean {
    return forestOn;
  }
  const forestMats: { mat: StandardMaterial; base: number }[] = [
    { mat: trunkMat, base: 1 },
    ...crownMats.map((mat) => ({ mat, base: 1 })),
    { mat: blobMat, base: 0.42 },
  ];
  function setForestVisible(v: boolean): void {
    // Instance meshes ignore enabled/visible/parent changes in this Babylon
    // version (verified on screen), but they share materials — fading those
    // to zero hides all ~6000 instances at once. Blob-shadow discs restore
    // to their own base alpha, not 1. (This also fixes the Forest toolbar
    // button, which never actually hid anything.) Residual real-time
    // shadows with the forest off are soft and faint; acceptable.
    for (const { mat, base } of forestMats) mat.alpha = v ? base : 0;
  }
  function setPanoMode(on: boolean): void {
    setForestVisible(on ? false : treesWanted());
    panoOccluders.forEach((m) => m.setEnabled(!on));
    // In a 360° photo the ground, trails, and course art are already in
    // the picture — the 3D versions only mismatch it. All regular meshes,
    // so setEnabled takes.
    terrain.setEnabled(!on);
    trailsMesh.setEnabled(on ? false : trailsVisibleNow());
    for (const m of [...windsocks, ...labels]) m.setEnabled(!on);
  }
  function trailsVisibleNow(): boolean {
    return (
      (
        document.getElementById("toggle-trails-walk") as HTMLElement | null
      )?.classList.contains("active") ?? true
    );
  }
  const veil = document.getElementById("fade-veil") as HTMLElement;
  let panoIdx = 0;
  // The Pixel sweeps are wide cylindrical strips, not spherical 360s, so a
  // full-viewport horizontal viewer is used instead of a Babylon PhotoDome.
  const flatPano = mountPanoViewer(document.body, {
    returnLabel: "Back to walk",
    mapHref: "./",
    onClose: () => hidePano(),
    onChange: (pano) => {
      const next = PANOS.findIndex((p) => p.id === pano.id);
      if (next >= 0) panoIdx = next;
    },
  });
  // Horizontal scroll sweeps the pano left-right (trackpad swipe).
  // Vertical scroll keeps its usual meaning outside pano mode.
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!panoOpen) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      yaw -= e.deltaX * 0.003;
    },
    { passive: true },
  );
  // Panos open in the full-viewport horizontal viewer. Callers may pass
  // a status to keep (e.g. the mountaintop card); otherwise a generic
  // pano status is shown.
  function showPanoAt(idx: number, status?: string): void {
    panoIdx = ((idx % PANOS.length) + PANOS.length) % PANOS.length;
    const p: PanoView = PANOS[panoIdx];
    const apply = () => {
      enterWalk(p.course);
      (document.getElementById("mode-walk") as HTMLElement).classList.add(
        "active",
      );
      (document.getElementById("mode-orbit") as HTMLElement).classList.remove(
        "active",
      );
      const [px, pz] = toWorld(p.lon, p.lat);
      walkCam.position.set(px, heightAt(p.lon, p.lat) + 2, pz);
      // Face the photographed clearing, not the treeline behind the pad.
      // yaw is verified per pano in config (default = walk heading).
      yaw = p.yaw ?? Math.PI;
      applyWalkRotation();
      setPanoMode(true);
      panoOpen = true;
      flatPano.open(p.id);
      setStatus(
        status ??
          `mountaintop pano — ${p.label.toLowerCase()} — drag to look around`,
      );
      veil.classList.remove("on");
    };
    if (REDUCED) {
      apply();
    } else {
      veil.classList.add("on");
      window.setTimeout(apply, 220);
    }
  }
  function hidePano(): void {
    panoOpen = false;
    if (flatPano.isOpen) flatPano.close();
    setPanoMode(false);
  }

  function enterOrbit(): void {
    mode = "orbit";
    scene.activeCamera = orbitCam;
    orbitCam.attachControl(canvas, true);
    hidePano();
    setStatus("Sky-Cam — drag to orbit, scroll to zoom");
  }

  // fly-to tween (orbit camera target + radius)
  let tween: {
    fromT: Vector3;
    toT: Vector3;
    fromR: number;
    toR: number;
    t: number;
  } | null = null;
  function flyTo(courseId: CourseId): void {
    const c = COURSES[courseId];
    flyToPoint(c.lon, c.lat);
  }
  function flyToPoint(lon: number, lat: number): void {
    hidePano();
    const [x, z] = toWorld(lon, lat);
    const y = heightAt(lon, lat);
    if (mode !== "orbit") {
      enterOrbit();
      (document.getElementById("mode-orbit") as HTMLElement).classList.add(
        "active",
      );
      (document.getElementById("mode-walk") as HTMLElement).classList.remove(
        "active",
      );
    }
    const dest = new Vector3(x, y, z);
    if (REDUCED) {
      orbitCam.target = dest;
      orbitCam.radius = 95;
      return;
    }
    tween = {
      fromT: orbitCam.target.clone(),
      toT: dest,
      fromR: orbitCam.radius,
      toR: 95,
      t: 0,
    };
  }

  // Nearest 360 to a ground point, in meters. Panos are wide strips shot
  // at the pads, so a pin within one pad-length opens its pano directly.
  function nearestPanoIdx(lon: number, lat: number, maxM: number): number {
    let nearest = -1;
    let nearestM = maxM;
    PANOS.forEach((p, i) => {
      const d = Math.hypot(
        (p.lon - lon) * mPerDegLon,
        (p.lat - lat) * M_PER_DEG_LAT,
      );
      if (d < nearestM) {
        nearestM = d;
        nearest = i;
      }
    });
    return nearest;
  }

  // Pin click -> load the asset: step into the 360 when the pin stands at
  // a pano, otherwise open the pin card with its photos and coordinates.
  // Course anchors still fly the camera there (click without drag).
  let downAt: [number, number] | null = null;
  canvas.addEventListener(
    "pointerdown",
    (e) => (downAt = [e.clientX, e.clientY]),
  );
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6)
      return;
    const rect = canvas.getBoundingClientRect();
    const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top);
    const hit = pick?.pickedMesh;
    if (hit && clickables.includes(hit as Mesh) && hit.metadata?.courseId) {
      flyTo(hit.metadata.courseId as CourseId);
    } else if (
      hit &&
      clickables.includes(hit as Mesh) &&
      hit.metadata?.survey
    ) {
      const props = hit.metadata.survey as HoleFeature["properties"];
      const panoIdx =
        typeof props.lon === "number" && typeof props.lat === "number"
          ? nearestPanoIdx(props.lon, props.lat, 30)
          : -1;
      if (panoIdx >= 0) showPanoAt(panoIdx);
      else showPinCard(props);
    }
  });

  // Byron Ligon start: the hole 3 tee, opening its pano when a verified
  // 360 exists at that pad. The current tiki survey carries no hole
  // numbers (all six points are unidentified), so until a survey drop
  // labels hole 3 this falls back to the course anchor — never a guess
  // from survey order (tiki-03 is a fix number, not a hole number).
  function tikiHole3Tee(): [number, number] | null {
    const f = pinFeats.find((feat) => {
      const p = feat.properties;
      const tag = `${p.name ?? ""} ${p.survey_id ?? ""}`.toLowerCase();
      return (
        p.kind === "tee" &&
        p.hole === 3 &&
        (tag.includes("tiki") || tag.includes("ligon"))
      );
    });
    if (!f || f.geometry.type !== "Point") return null;
    const [lon, lat] = f.geometry.coordinates as number[];
    return [lon, lat];
  }
  function flyTikiStart(): void {
    const tee3 = tikiHole3Tee();
    if (!tee3) {
      flyTo("tiki");
      return;
    }
    const [lon, lat] = tee3;
    let nearest = -1;
    let nearestM = Infinity;
    PANOS.forEach((p, i) => {
      if (p.course !== "tiki") return;
      const d = Math.hypot(
        (p.lon - lon) * mPerDegLon,
        (p.lat - lat) * M_PER_DEG_LAT,
      );
      if (d < nearestM) {
        nearestM = d;
        nearest = i;
      }
    });
    if (nearest >= 0 && nearestM <= 25) {
      showPanoAt(nearest);
      return;
    }
    flyToPoint(lon, lat);
    setStatus("Byron Ligon — hole 3 tee");
  }

  // ---------- UI ----------
  (document.getElementById("fly-tiki") as HTMLButtonElement).addEventListener(
    "click",
    () => flyTikiStart(),
  );
  (
    document.getElementById("fly-community") as HTMLButtonElement
  ).addEventListener("click", () => flyTo("community"));
  (document.getElementById("mode-orbit") as HTMLButtonElement).addEventListener(
    "click",
    (e) => {
      enterOrbit();
      (e.target as HTMLElement).classList.add("active");
      (document.getElementById("mode-walk") as HTMLElement).classList.remove(
        "active",
      );
    },
  );
  (document.getElementById("mode-walk") as HTMLButtonElement).addEventListener(
    "click",
    (e) => {
      enterWalk("tiki");
      // Start at the hole 3 tee when the survey labels one (see
      // tikiHole3Tee — not in the current data).
      const tee3 = tikiHole3Tee();
      if (tee3) {
        const [x, z] = toWorld(tee3[0], tee3[1]);
        walkCam.position.set(x + 3, heightAt(tee3[0], tee3[1]) + 0.8, z + 12);
        setStatus("First Person — Byron Ligon hole 3 tee. WASD to move");
      }
      hidePano();
      (e.target as HTMLElement).classList.add("active");
      (document.getElementById("mode-orbit") as HTMLElement).classList.remove(
        "active",
      );
    },
  );
  // NOTE: setEnabled (not isVisible) propagates through the instance hierarchy.
  (
    document.getElementById("toggle-trails-walk") as HTMLButtonElement
  ).addEventListener("click", (e) => {
    trailsMesh.setEnabled(!trailsMesh.isEnabled());
    (e.target as HTMLElement).classList.toggle(
      "active",
      trailsMesh.isEnabled(),
    );
  });
  (
    document.getElementById("toggle-trees") as HTMLButtonElement
  ).addEventListener("click", (e) => {
    forestOn = !forestOn;
    setForestVisible(forestOn);
    (e.target as HTMLElement).classList.toggle("active", forestOn);
  });
  // Mountaintop: fly the walk camera to Community tee box 2 and open its
  // ingested 360 directly, with no intermediate pin card.
  function goMountaintop(): void {
    const idx = PANOS.findIndex((p) => p.id === "tee2-area");
    if (idx < 0) {
      setStatus("Mountaintop pano is not available in this build");
      return;
    }
    // The specific status rides inside showPanoAt: apply() runs after a
    // fade delay, so a status set here would be overwritten by the
    // generic pano status.
    showPanoAt(idx, "Mountaintop — Community tee box 2, Hole 2, par 3, 245 ft");
  }
  (document.getElementById("pano-tiki") as HTMLButtonElement).addEventListener(
    "click",
    () => goMountaintop(),
  );
  (
    document.getElementById("pin-close") as HTMLButtonElement | null
  )?.addEventListener("click", () => {
    if (pinCard) pinCard.hidden = true;
  });
  // Deep link from the map/story galleries: walk.html?pano=tee2-area.
  // tee2 preserves the pre-rename address for the same tee-box-2 view.
  const rawPano = new URLSearchParams(location.search).get("pano");
  const wantPano = rawPano === "tee2" ? "tee2-area" : rawPano;
  if (wantPano) {
    const idx = PANOS.findIndex((p) => p.id === wantPano);
    if (idx >= 0) showPanoAt(idx);
  }
  // First person on any screen: walk camera + fullscreen + exit chip.
  // Headsets switch to immersive-vr when one is present.
  const exitChip = document.getElementById(
    "fullscreen-exit",
  ) as HTMLButtonElement;
  function exitFirstPerson(): void {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => undefined);
    exitChip.hidden = true;
    enterOrbit();
  }
  exitChip.addEventListener("click", exitFirstPerson);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !exitChip.hidden) exitFirstPerson();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) exitChip.hidden = true;
  });
  let xrHelper: {
    baseExperience: { enterXRAsync: (m: string, f: string) => Promise<void> };
  } | null = null;
  async function enterFirstPerson(): Promise<void> {
    hidePano();
    enterWalk("community");
    (document.getElementById("mode-walk") as HTMLElement).classList.add(
      "active",
    );
    (document.getElementById("mode-orbit") as HTMLElement).classList.remove(
      "active",
    );
    try {
      await canvas.requestFullscreen?.();
      exitChip.hidden = false;
      setStatus(
        "first person — WASD to walk the Community course, Esc to exit",
      );
    } catch {
      setStatus("first person active (fullscreen unavailable) — WASD to walk");
    }
    const nav = navigator as Navigator & {
      xr?: { isSessionSupported: (m: string) => Promise<boolean> };
    };
    if (nav.xr && (await nav.xr.isSessionSupported("immersive-vr"))) {
      try {
        if (!xrHelper) {
          xrHelper = (await scene.createDefaultXRExperienceAsync({
            floorMeshes: [terrain],
          })) as unknown as typeof xrHelper;
        }
        await xrHelper?.baseExperience.enterXRAsync(
          "immersive-vr",
          "local-floor",
        );
        setStatus("VR session active — teleport with the controllers");
      } catch {
        /* desktop first-person already active — not an error */
      }
    }
  }
  (document.getElementById("enter-fp") as HTMLButtonElement).addEventListener(
    "click",
    () => void enterFirstPerson(),
  );

  const judgesCard = document.getElementById("judges-card") as HTMLElement;
  const judgesToggle = document.getElementById(
    "judges-toggle",
  ) as HTMLButtonElement;
  judgesToggle.addEventListener("click", () => {
    judgesCard.hidden = !judgesCard.hidden;
    judgesToggle.setAttribute("aria-expanded", String(!judgesCard.hidden));
  });
  (
    document.getElementById("judges-close") as HTMLButtonElement
  ).addEventListener("click", () => {
    judgesCard.hidden = true;
    judgesToggle.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("resize", () => engine.resize());

  // ---------- loop ----------
  let elapsed = 0;
  let last = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    for (const sock of windsocks) {
      sock.rotation.y = Math.sin(elapsed * 0.7) * 0.5;
    }
    // The flat pano viewer is DOM-based and independent of the walk camera,
    // so walking can continue under the open pano overlay.
    // Keep labels legible at any range: roughly constant screen size.
    const camPos = mode === "walk" ? walkCam.position : orbitCam.position;
    const activeCam = mode === "walk" ? walkCam : orbitCam;
    const viewport = activeCam.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight(),
    );
    const transform = scene.getTransformMatrix();
    for (const label of labels) {
      const dist = Vector3.Distance(camPos, label.position);
      label.scaling.setAll(Math.max(0.3, Math.min(1.6, dist / 60)));
      // Hide labels whose billboard edges touch the canvas rim, so pills
      // never clip half-on (e.g. "…munity" at a phone edge).
      const s = label.scaling.x;
      const right = activeCam
        .getDirection(new Vector3(1, 0, 0))
        .scaleInPlace(9 * s);
      const up = activeCam
        .getDirection(new Vector3(0, 1, 0))
        .scaleInPlace(2.25 * s);
      const lp = Vector3.Project(
        label.position.subtract(right),
        Matrix.Identity(),
        transform,
        viewport,
      );
      const rp = Vector3.Project(
        label.position.add(right),
        Matrix.Identity(),
        transform,
        viewport,
      );
      const tp = Vector3.Project(
        label.position.add(up),
        Matrix.Identity(),
        transform,
        viewport,
      );
      const bp = Vector3.Project(
        label.position.subtract(up),
        Matrix.Identity(),
        transform,
        viewport,
      );
      const margin = 4;
      label.isVisible =
        lp.x > -margin &&
        rp.x < viewport.width + margin &&
        bp.y > -margin &&
        tp.y < viewport.height + margin;
    }
    if (tween) {
      tween.t += dt / 1.2;
      const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3);
      orbitCam.target = Vector3.Lerp(tween.fromT, tween.toT, k);
      orbitCam.radius = tween.fromR + (tween.toR - tween.fromR) * k;
      if (tween.t >= 1) tween = null;
    }
    if (mode === "walk") {
      applyWalkRotation();
      const speed =
        (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 18 : 6) * dt;
      // NOTE: Babylon facing: yaw=PI looks -Z (verified on screen). Three.js
      // intuition for the forward vector is flipped here.
      const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new Vector3(-fwd.z, 0, fwd.x);
      const move = new Vector3();
      if (keys.has("KeyW") || keys.has("ArrowUp")) move.addInPlace(fwd);
      if (keys.has("KeyS") || keys.has("ArrowDown")) move.subtractInPlace(fwd);
      if (keys.has("KeyD") || keys.has("ArrowRight")) move.addInPlace(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft"))
        move.subtractInPlace(right);
      if (move.lengthSquared() > 0) {
        move.normalize().scaleInPlace(speed);
        let nx = Math.max(
          -widthU / 2,
          Math.min(widthU / 2, walkCam.position.x + move.x),
        );
        let nz = Math.max(
          -depthU / 2,
          Math.min(depthU / 2, walkCam.position.z + move.z),
        );
        // Stop radius around pins and trunks: push out, never enter.
        const pushOut = (px: number, pz: number, r: number): void => {
          const dx = nx - px;
          const dz = nz - pz;
          const d = Math.hypot(dx, dz);
          if (d < r && d > 1e-6) {
            nx = px + (dx / d) * r;
            nz = pz + (dz / d) * r;
          }
        };
        for (const [px, pz] of pinPts) pushOut(px, pz, 3.0);
        for (const [px, pz] of sockPts) pushOut(px, pz, 0.7);
        for (const t of placed) pushOut(t.x, t.z, 0.5);
        const lon = cLon + (nx * UNIT_M) / mPerDegLon;
        const lat = cLat - (nz * UNIT_M) / M_PER_DEG_LAT;
        walkCam.position.set(nx, heightAt(lon, lat) + 0.8, nz);
      }
    }
    scene.render();
  });

  setStatus("ready — Sky-Cam to explore, or First Person to walk");
}

void main().catch((e: unknown) => {
  showError(`startup failed: ${(e as Error)?.message ?? e}`);
  setStatus("walkthrough failed to start — see error above");
});

// ---------- radio equalizer (Babylon, decorative) ----------
// Small frequency-bar scene on its own tiny Engine inside the shared
// radio player's footer dock — never on the walk canvas. Fully
// decoupled from main(): any failure here removes the bars and leaves
// radio playback untouched. Real FFT data via WebAudio when the
// stream proves CORS-readable (all three stations send
// Access-Control-Allow-Origin through their redirects, probed at
// runtime before the element is switched to CORS mode); otherwise
// gentle simulated bars while playing. Skipped entirely under
// prefers-reduced-motion.
interface DgRadioMount {
  mount: HTMLElement;
  audio: HTMLAudioElement;
}

// Returns true when settled (mounted, or permanently skipped);
// false means the radio script has not mounted yet — retry. The
// walk module can execute before the deferred radio-tuner.js.
function setupRadioEq(): boolean {
  if (REDUCED) return true;
  const reg = (window as unknown as { __dgRadioMounts?: DgRadioMount[] })
    .__dgRadioMounts;
  const mount =
    reg?.[0]?.mount ??
    (document.querySelector("[data-radio-tuner]") as HTMLElement | null);
  const audio =
    reg?.[0]?.audio ??
    (mount?.querySelector("audio") as HTMLAudioElement | null);
  if (!mount || !audio) return false;

  const canvas = document.createElement("canvas");
  canvas.className = "rt-eq";
  canvas.setAttribute("aria-hidden", "true");
  mount.appendChild(canvas);

  let engine: Engine;
  try {
    engine = new Engine(canvas, false);
  } catch {
    canvas.remove();
    return true;
  }
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const cam = new ArcRotateCamera(
    "eq-cam",
    -Math.PI / 2,
    Math.PI / 2,
    10,
    new Vector3(0, 0.55, 0),
    scene,
  );
  cam.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  const fitOrtho = (): void => {
    const aspect = Math.max(
      2,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
    );
    cam.orthoTop = 1.15;
    cam.orthoBottom = -0.05;
    cam.orthoLeft = -0.6 * aspect;
    cam.orthoRight = 0.6 * aspect;
  };
  fitOrtho();
  new HemisphericLight("eq-light", new Vector3(0, 1, -0.4), scene);
  const barMat = new StandardMaterial("eq-mat", scene);
  barMat.diffuseColor = new Color3(0.08, 0.24, 0.16);
  barMat.emissiveColor = new Color3(0.04, 0.14, 0.09);
  barMat.disableLighting = true;

  const N = 24;
  const bars: Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const bar = MeshBuilder.CreateBox(
      `eq-bar-${i}`,
      { width: 0.36, height: 1, depth: 0.1 },
      scene,
    );
    bar.material = barMat;
    bar.position.x = (i - (N - 1) / 2) * 0.52;
    bars.push(bar);
  }
  const levels = new Array<number>(N).fill(0.06);
  const drawBars = (): void => {
    for (let i = 0; i < N; i++) {
      const h = Math.max(0.04, Math.min(1, levels[i]));
      bars[i].scaling.y = h;
      bars[i].position.y = h / 2;
    }
    scene.render();
  };

  // --- audio analysis, opt-in only after a live CORS probe ---
  let analyser: AnalyserNode | null = null;
  let freq: Uint8Array | null = null;
  let audioCtx: AudioContext | null = null;
  let corsOk = false;
  let simulated = false;
  let zeroFrames = 0;
  const probeSrc = audio.currentSrc || audio.getAttribute("src") || "";
  if (probeSrc) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    fetch(probeSrc, { method: "HEAD", mode: "cors", signal: ctl.signal })
      .then(() => {
        corsOk = true;
        // preload="none": nothing fetched yet, so switching the
        // element to CORS mode now cannot disturb playback.
        if (audio.readyState === 0) audio.crossOrigin = "anonymous";
      })
      .catch(() => {
        corsOk = false;
      })
      .finally(() => clearTimeout(timer));
  }
  const attachAnalyser = (): void => {
    if (analyser || !corsOk || audio.crossOrigin !== "anonymous") return;
    try {
      audioCtx = new AudioContext();
      const src = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch {
      analyser = null;
      freq = null;
      audioCtx = null;
    }
  };

  let running = false;
  engine.runRenderLoop(() => {
    if (!running || document.hidden || canvas.getClientRects().length === 0)
      return;
    const t = performance.now() / 1000;
    let heard = false;
    if (analyser && freq && !simulated) {
      analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
      for (let i = 0; i < N; i++) {
        const bin = 1 + Math.floor(Math.pow(i / N, 1.6) * (freq.length - 2));
        // sqrt lifts quiet speech so bars read at dock size
        const target = 0.05 + Math.sqrt(freq[bin] / 255) * 0.95;
        if (freq[bin] > 4) heard = true;
        levels[i] += (target - levels[i]) * 0.4;
      }
      // tainted/silent data: keep the picture honest but alive
      if (!heard && ++zeroFrames > 120) simulated = true;
      if (heard) zeroFrames = 0;
    } else {
      for (let i = 0; i < N; i++) {
        const target =
          0.3 +
          0.22 * Math.sin(t * 2.1 + i * 0.7) +
          0.14 * Math.sin(t * 5.3 + i * 1.7);
        levels[i] += (Math.max(0.06, target) - levels[i]) * 0.25;
      }
    }
    drawBars();
  });

  audio.addEventListener("playing", () => {
    attachAnalyser();
    void audioCtx?.resume().catch(() => undefined);
    running = true;
  });
  const stop = (): void => {
    running = false;
    for (let i = 0; i < N; i++) levels[i] = 0.06;
    if (canvas.getClientRects().length > 0) drawBars();
  };
  audio.addEventListener("pause", stop);
  audio.addEventListener("error", stop);
  mount.closest("details")?.addEventListener("toggle", () => {
    engine.resize();
    fitOrtho();
    if (!running && canvas.getClientRects().length > 0) drawBars();
  });
  window.addEventListener("resize", () => {
    engine.resize();
    fitOrtho();
  });
  return true;
}

try {
  if (!setupRadioEq()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      try {
        if (setupRadioEq() || tries >= 40) clearInterval(timer);
      } catch {
        clearInterval(timer);
      }
    }, 150);
  }
} catch {
  // decorative only — never surface an error or touch playback
}
