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
import { COURSES, MOUNTAINTOP_PANO, PANOS } from "./config";
import type { CourseId, PanoView } from "./config";
import { PhotoDome } from "@babylonjs/core/Helpers/photoDome.js";
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
  placed.forEach((t, i) => {
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
    ctx.font = "600 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(id === "tiki" ? "Byron Ligon Tiki" : "Community", 256, 58);
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

  // ---------- surveyed hole pins (Nov 1 ground truth) ----------
  interface HoleFeature {
    geometry: { type: string; coordinates: number[] | number[][] };
    properties: { kind: string; hole?: number };
  }
  interface HolesFile2 {
    features?: HoleFeature[];
  }
  async function holePins(): Promise<void> {
    const data = (await (
      await fetch(COURSES.community.holesUrl)
    ).json()) as HolesFile2;
    const feats = data.features ?? [];
    const pts: Record<string, [number, number, number]> = {};
    for (const f of feats) {
      const k = f.properties.kind;
      if (f.geometry.type === "Point" && (k === "tee" || k === "basket")) {
        const [lon, lat] = f.geometry.coordinates as number[];
        const [x, z] = toWorld(lon, lat);
        pts[`${k}${f.properties.hole ?? ""}`] = [x, heightAt(lon, lat), z];
      }
    }
    const teeMat = new StandardMaterial("teeMat", scene);
    teeMat.diffuseColor = new Color3(0.1, 0.32, 0.46);
    const basketMat2 = new StandardMaterial("basketMat2", scene);
    basketMat2.diffuseColor = new Color3(0.72, 0.57, 0.04);
    for (const [key, [x, y, z]] of Object.entries(pts)) {
      const isTee = key.startsWith("tee");
      const m = isTee
        ? MeshBuilder.CreateSphere(key, { diameter: 1.2 }, scene)
        : MeshBuilder.CreateCylinder(
            key,
            { diameterTop: 1.2, diameterBottom: 0.84, height: 0.4 },
            scene,
          );
      m.position.set(x, y + 1, z);
      m.material = isTee ? teeMat : basketMat2;
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
    setStatus("walk mode — drag to look, WASD/arrows to move, shift to hurry");
  }

  const panoCard = document.getElementById("pano-card") as HTMLElement;
  const panoCaption = document.getElementById("pano-caption") as HTMLElement;
  const veil = document.getElementById("fade-veil") as HTMLElement;
  let panoDome: PhotoDome | null = null;
  let panoIdx = PANOS.indexOf(MOUNTAINTOP_PANO);
  // Stand on the mountaintop: real 360° survey photo at the tee, walk camera
  // at disc-flight height so drag looks around from the pad.
  function showPanoAt(idx: number): void {
    panoIdx = ((idx % PANOS.length) + PANOS.length) % PANOS.length;
    const p: PanoView = PANOS[panoIdx];
    const apply = () => {
      enterWalk("community");
      walkCam.position.y += 1.2;
      if (!panoDome) {
        panoDome = new PhotoDome("pano", p.file, { size: 400 }, scene);
      } else {
        const lat = (panoDome as { texture?: { url: string } }).texture;
        if (lat) lat.url = p.file;
        panoDome.isVisible = true;
      }
      panoCard.hidden = false;
      panoCaption.textContent = `${p.label} (${panoIdx + 1} of ${PANOS.length} panos — ground survey, Nov 1)`;
      setStatus(
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
    if (panoDome) panoDome.isVisible = false;
    panoCard.hidden = true;
  }

  function enterOrbit(): void {
    mode = "orbit";
    scene.activeCamera = orbitCam;
    orbitCam.attachControl(canvas, true);
    hidePano();
    setStatus("orbit mode — drag to orbit, scroll to zoom");
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
    hidePano();
    const c = COURSES[courseId];
    const [x, z] = toWorld(c.lon, c.lat);
    const y = heightAt(c.lon, c.lat);
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

  // pin click -> fly there (click without drag)
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
    }
  });

  // ---------- UI ----------
  (document.getElementById("fly-tiki") as HTMLButtonElement).addEventListener(
    "click",
    () => flyTo("tiki"),
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
      panoCard.hidden = true;
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
    forest.setEnabled(!forest.isEnabled());
    (e.target as HTMLElement).classList.toggle("active", forest.isEnabled());
  });
  (document.getElementById("pano-tiki") as HTMLButtonElement).addEventListener(
    "click",
    () => {
      showPanoAt(PANOS.indexOf(MOUNTAINTOP_PANO));
      (document.getElementById("mode-walk") as HTMLElement).classList.add(
        "active",
      );
      (document.getElementById("mode-orbit") as HTMLElement).classList.remove(
        "active",
      );
    },
  );
  (document.getElementById("pano-prev") as HTMLButtonElement).addEventListener(
    "click",
    () => showPanoAt(panoIdx - 1),
  );
  (document.getElementById("pano-next") as HTMLButtonElement).addEventListener(
    "click",
    () => showPanoAt(panoIdx + 1),
  );
  (
    document.getElementById("pano-dismiss") as HTMLButtonElement
  ).addEventListener("click", () => {
    hidePano();
    setStatus("walk mode — drag to look, WASD/arrows to move, shift to hurry");
  });
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
    // The pano dome rides the camera so walking never exits the photo.
    if (panoDome?.isVisible) panoDome.position.copyFrom(walkCam.position);
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

  setStatus("walkthrough ready — orbit to explore, or switch to walk mode");
}

void main().catch((e: unknown) => {
  showError(`startup failed: ${(e as Error)?.message ?? e}`);
  setStatus("walkthrough failed to start — see error above");
});
