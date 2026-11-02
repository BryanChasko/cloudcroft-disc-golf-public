import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { withIdentityPoolId } from "@aws/amazon-location-utilities-auth-helper";
import {
  API_BASE,
  COURSES,
  DATA,
  IDENTITY_POOL_ID,
  MAPS,
  REGION,
} from "./config";
import type { Basemap, CourseId } from "./config";
import "./style.css";

const statusEl = document.getElementById("status") as HTMLElement;
function setStatus(msg: string) {
  statusEl.textContent = msg;
}

function styleUrl(mapName: string): string {
  return `https://maps.geo.${REGION}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
}

function haversineFt(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 20902231;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

interface HoleRow {
  hole: number;
  par?: number;
  distance_ft?: number;
  note?: string;
  status?: "surveyed" | "remote" | "scaffold";
  par_source?: string;
}
interface SurveyFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: {
    kind?: string;
    hole?: number;
    survey_id?: string;
    name?: string;
    note?: string;
    remark?: string;
    lat?: number;
    lon?: number;
    course?: string;
    photo?: string | null;
    photos_web?: string[];
    photo_remarks?: string[];
    elevation_m?: number;
    accuracy_h_m?: number;
    averaging?: number;
    sats_in_use?: number;
  };
}
interface HolesFile {
  course: {
    name: string;
    holes: number;
    par: number | string;
    length_ft: number | string;
  };
  holes: HoleRow[];
  features?: SurveyFeature[];
}

let map: maplibregl.Map;
let transformRequest: maplibregl.RequestTransformFunction;
let currentCourse: CourseId = "tiki";
let trailsVisible = true;
let naipVisible = false;
const courseMarkers = {} as Record<CourseId, maplibregl.Marker>;
const holesCache = {} as Record<CourseId, HolesFile | undefined>;

async function holesFor(courseId: CourseId): Promise<HolesFile> {
  const cached = holesCache[courseId];
  if (cached) return cached;
  const data = (await (
    await fetch(COURSES[courseId].holesUrl)
  ).json()) as HolesFile;
  holesCache[courseId] = data;
  return data;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function surveyPopupHtml(p: SurveyFeature["properties"]): string {
  const bits: string[] = [`<strong>${esc(p.name ?? "survey point")}</strong>`];
  bits.push(
    `<span class="pop-kind">${esc(p.kind ?? "")}${p.hole ? ` · hole ${p.hole}` : ""} · ${esc(p.survey_id ?? "")}</span>`,
  );
  if (p.photo) {
    bits.push(
      `<img class="pop-photo" src="${esc(p.photo)}" alt="Field photo at ${esc(p.name ?? "survey point")}" loading="lazy">`,
    );
  }
  if (p.note) bits.push(`<span>${esc(p.note)}</span>`);
  if (typeof p.lat === "number" && typeof p.lon === "number") {
    bits.push(
      `<span class="pop-coords">${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</span>`,
    );
  }
  const meta: string[] = [];
  if (typeof p.elevation_m === "number")
    meta.push(`elev ${p.elevation_m.toFixed(1)} m`);
  if (typeof p.accuracy_h_m === "number") meta.push(`±${p.accuracy_h_m} m`);
  if (typeof p.averaging === "number") meta.push(`${p.averaging}-fix avg`);
  if (meta.length)
    bits.push(`<span class="pop-meta">${esc(meta.join(" · "))}</span>`);
  return bits.join("<br>");
}

interface SurveyAsset {
  asset_id: string;
  kind: "photo" | "pano" | "screenshot";
  label: string;
  lat: number | null;
  lon: number | null;
  web_url: string;
  pano_id?: string;
}

async function renderFieldGallery(): Promise<void> {
  const host = document.getElementById("field-gallery");
  if (!host) return;
  try {
    const data = (await (await fetch(DATA.surveyAssets)).json()) as {
      assets: SurveyAsset[];
    };
    const photos = data.assets.filter((a) => a.kind === "photo");
    const panos = data.assets.filter((a) => a.kind === "pano");
    const fig = (a: SurveyAsset, href?: string) => {
      const coords =
        a.lat !== null && a.lon !== null
          ? ` — ${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`
          : "";
      const img = `<img src="${esc(a.web_url)}" alt="${esc(a.label)}" loading="lazy">`;
      return `<figure>${href ? `<a href="${href}">${img}</a>` : img}<figcaption>${esc(a.label)}${coords}</figcaption></figure>`;
    };
    host.innerHTML =
      `<h3>Every photo from the November 1 field day (${photos.length})</h3>` +
      `<div class="gallery-grid">${photos.map((a) => fig(a)).join("")}</div>` +
      `<h3>Panoramas (${panos.length}) — open in the 3D walk to stand in them</h3>` +
      `<div class="gallery-grid">${panos.map((a) => fig(a, `./walk.html?pano=${encodeURIComponent(a.pano_id ?? "")}`)).join("")}</div>`;
  } catch {
    host.innerHTML = '<p class="note">field gallery failed to load</p>';
  }
}

function basemap(): Basemap {
  const checked = document.querySelector(
    'input[name="basemap"]:checked',
  ) as HTMLInputElement;
  return (checked?.value as Basemap) ?? "topo";
}

function addOverlays(): void {
  // Trails from our OSM extract.
  if (!map.getSource("trails")) {
    map.addSource("trails", { type: "geojson", data: DATA.trails });
    map.addLayer({
      id: "trails-line",
      type: "line",
      source: "trails",
      paint: {
        "line-color": "#8a5a2b",
        "line-width": 2,
        "line-dasharray": [2, 1.5],
      },
    });
  }
  map.setLayoutProperty(
    "trails-line",
    "visibility",
    trailsVisible ? "visible" : "none",
  );

  // Survey features for the active course (tees, baskets, fairways).
  if (!map.getSource("survey")) {
    map.addSource("survey", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "survey-fairway",
      type: "line",
      source: "survey",
      filter: ["==", ["get", "kind"], "fairway"],
      paint: { "line-color": "#2e7d32", "line-width": 3 },
    });
    map.addLayer({
      id: "survey-points",
      type: "circle",
      source: "survey",
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match",
          ["get", "kind"],
          "tee",
          "#1a5276",
          "basket",
          "#b7950b",
          "#9e9e9e",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
  }
  void refreshSurveyLayer();

  // Course anchors.
  for (const [id, c] of Object.entries(COURSES)) {
    const el = document.createElement("div");
    el.className = `pin pin-${id}`;
    el.textContent = id === "tiki" ? "9" : "18";
    courseMarkers[id as CourseId] = new maplibregl.Marker({ element: el })
      .setLngLat([c.lon, c.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 18 }).setHTML(
          `<strong>${c.name}</strong><br>${c.blurb}<br>elevation ${c.eleFt.toLocaleString()} ft`,
        ),
      )
      .addTo(map);
  }
}

async function setNaip(visible: boolean): Promise<void> {
  naipVisible = visible;
  if (!visible) {
    if (map.getLayer("naip-layer")) map.removeLayer("naip-layer");
    if (map.getSource("naip")) map.removeSource("naip");
    return;
  }
  try {
    const meta = (await (await fetch(DATA.naipMeta)).json()) as {
      bbox: [number, number, number, number];
    };
    const [w, s, e, n] = meta.bbox;
    if (!map.getSource("naip")) {
      map.addSource("naip", {
        type: "image",
        url: DATA.naip,
        coordinates: [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ],
      });
      map.addLayer({
        id: "naip-layer",
        type: "raster",
        source: "naip",
        paint: { "raster-opacity": 0.85 },
      });
    }
  } catch {
    setStatus("NAIP overlay failed to load (needs the live site origin)");
  }
}

async function refreshSurveyLayer(): Promise<void> {
  const src = map?.getSource("survey") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  try {
    const data = await holesFor(currentCourse);
    src.setData({
      type: "FeatureCollection",
      features: (data.features ?? []) as never[],
    });
  } catch {
    // leave prior features in place; table render reports failures
  }
}

async function renderHoles(courseId: CourseId): Promise<void> {
  const tbody = document.querySelector("#holes tbody") as HTMLElement;
  tbody.innerHTML = "";
  try {
    const data = await holesFor(courseId);
    // Score form follows the active course (9 vs 18 holes).
    (document.getElementById("score-hole") as HTMLInputElement).max = String(
      data.course.holes,
    );
    const surveyed = data.holes.filter((h) => h.status === "surveyed").length;
    const statusEl2 = document.getElementById("survey-status");
    if (statusEl2) {
      statusEl2.textContent = `${surveyed} of ${data.course.holes} holes surveyed — watch the card fill in`;
    }
    if (data.holes.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = `${data.course.holes} holes · par ${data.course.par} — per-hole survey lands with ground GPS.`;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    for (const h of data.holes) {
      const tr = document.createElement("tr");
      const status = h.status ?? "remote";
      if (status === "scaffold") tr.className = "scaffold";
      const par = h.par ?? "—";
      const dist = h.distance_ft ? `${h.distance_ft} ft` : "awaiting survey";
      const label =
        status === "surveyed"
          ? "surveyed"
          : status === "scaffold"
            ? "scaffold"
            : "remote";
      tr.innerHTML = `<td>${h.hole}</td><td>${par}</td><td>${dist}${h.note ? ` (${h.note})` : ""}</td><td><span class="status-chip">${label}</span></td>`;
      tr.title = h.par_source
        ? `par source: ${h.par_source}`
        : "click to fly here";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        flyToCourse(courseId);
        courseMarkers[courseId]?.togglePopup();
      });
      tbody.appendChild(tr);
    }
  } catch {
    tbody.innerHTML = '<tr><td colspan="4">hole data failed to load</td></tr>';
  }
}

function flyToCourse(courseId: CourseId): void {
  const c = COURSES[courseId];
  map.flyTo({ center: [c.lon, c.lat], zoom: 16, essential: true });
}

// ---------- scorecard ----------
function deviceId(): string {
  let id = localStorage.getItem("disc-golf-device");
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    localStorage.setItem("disc-golf-device", id);
  }
  return id;
}

function currentRound(): string | null {
  return localStorage.getItem("disc-golf-round");
}

let refreshGen = 0;
async function refreshScores(): Promise<void> {
  const gen = ++refreshGen;
  const list = document.getElementById("scores") as HTMLElement;
  const roundId = currentRound();
  if (!roundId) {
    list.innerHTML = "";
    return;
  }
  try {
    const res = await fetch(
      `${API_BASE}/scorecard?round_id=${encodeURIComponent(roundId)}`,
    );
    const data = (await res.json()) as { entries: Record<string, unknown>[] };
    if (gen !== refreshGen) return; // superseded by a newer refresh
    list.innerHTML = "";
    const holes = data.entries
      .filter(
        (e) =>
          typeof e["entry"] === "string" &&
          (e["entry"] as string).startsWith("hole#"),
      )
      .sort((a, b) => String(a["entry"]).localeCompare(String(b["entry"])));
    if (holes.length === 0) {
      list.innerHTML = "<li>no scores yet</li>";
      return;
    }
    // Par lookup per entry course (rounds are single-course in practice,
    // but entries carry their own course — honor it).
    const parOf = new Map<string, number>();
    for (const e of holes) {
      const key = `${e["course"]}#${e["hole"]}`;
      if (parOf.has(key)) continue;
      try {
        const file = await holesFor(e["course"] as CourseId);
        const row = file.holes.find((r) => r.hole === Number(e["hole"]));
        if (row && row.par !== undefined) parOf.set(key, row.par);
      } catch {
        // Unknown par: total shows without vs-par below.
      }
    }
    if (gen !== refreshGen) return; // superseded during par lookup
    let total = 0;
    let parTotal = 0;
    let parsKnown = true;
    for (const h of holes) {
      const n = Number(String(h["entry"]).replace("hole#", ""));
      const strokes = Number(h["strokes"] ?? 0);
      const li = document.createElement("li");
      li.textContent = `Hole ${n} — ${strokes} strokes`;
      list.appendChild(li);
      total += strokes;
      const par = parOf.get(`${h["course"]}#${h["hole"]}`);
      if (par === undefined) parsKnown = false;
      else parTotal += par;
    }
    const li = document.createElement("li");
    if (parsKnown) {
      const diff = total - parTotal;
      const vs = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
      li.innerHTML = `<strong>Total: ${total} (${vs} vs par)</strong>`;
    } else {
      li.innerHTML = `<strong>Total: ${total} (${holes.length} holes)</strong>`;
    }
    list.appendChild(li);
  } catch {
    list.innerHTML = "<li>scores failed to load</li>";
  }
}

function wireScorecard(): void {
  const roundLabel = document.getElementById("round-id") as HTMLElement;
  const holeScore = document.getElementById("hole-score") as HTMLElement;
  const showRound = () => {
    const r = currentRound();
    roundLabel.textContent = r ?? "no active round";
    holeScore.hidden = !r;
  };
  showRound();
  void refreshScores();

  (document.getElementById("new-round") as HTMLButtonElement).addEventListener(
    "click",
    async () => {
      const id = `${deviceId()}-${Date.now().toString(36)}`;
      localStorage.setItem("disc-golf-round", id);
      showRound();
      await fetch(`${API_BASE}/scorecard`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          round_id: id,
          entry: "meta",
          device_id: deviceId(),
          course: currentCourse,
        }),
      });
      void refreshScores();
    },
  );

  (document.getElementById("save-score") as HTMLButtonElement).addEventListener(
    "click",
    async () => {
      const status = document.getElementById("save-status") as HTMLElement;
      const hole = Number(
        (document.getElementById("score-hole") as HTMLInputElement).value,
      );
      const strokes = Number(
        (document.getElementById("score-strokes") as HTMLInputElement).value,
      );
      const roundId = currentRound();
      if (!roundId) return;
      const maxHole = Number(
        (document.getElementById("score-hole") as HTMLInputElement).max,
      );
      if (!Number.isInteger(hole) || hole < 1 || hole > maxHole) {
        status.textContent = `hole must be 1–${maxHole} on this course`;
        return;
      }
      if (!Number.isInteger(strokes) || strokes < 1 || strokes > 20) {
        status.textContent = "strokes must be 1–20";
        return;
      }
      status.textContent = "saving…";
      try {
        const res = await fetch(`${API_BASE}/scorecard`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            round_id: roundId,
            entry: `hole#${String(hole).padStart(2, "0")}`,
            course: currentCourse,
            hole,
            strokes,
          }),
        });
        status.textContent = res.ok ? "saved" : `error ${res.status}`;
        void refreshScores();
      } catch {
        status.textContent = "save failed";
      }
    },
  );
}

// ---------- boot ----------
async function main(): Promise<void> {
  // Deep links from the story page: ?course=community&hole=2
  const params = new URLSearchParams(location.search);
  const wantCourse = params.get("course");
  if (wantCourse === "tiki" || wantCourse === "community") {
    currentCourse = wantCourse;
    document.querySelectorAll("#course-tabs button").forEach((b) => {
      b.classList.toggle(
        "active",
        (b as HTMLElement).dataset["course"] === wantCourse,
      );
    });
  }
  setStatus("authenticating…");
  const authHelper = await withIdentityPoolId(IDENTITY_POOL_ID, {
    clientConfig: { region: REGION },
  });
  transformRequest = authHelper.getMapAuthenticationOptions()
    .transformRequest as maplibregl.RequestTransformFunction;

  const c = COURSES[currentCourse];
  map = new maplibregl.Map({
    container: "map",
    style: styleUrl(MAPS.topo),
    center: [c.lon, c.lat],
    zoom: 15,
    transformRequest,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.on("load", () => {
    addOverlays();
    setStatus("map live — topo + trails");
  });
  // Per-point popups: name, note, coordinates, field photo (registered
  // once; addOverlays re-runs on style swap and must not duplicate).
  map.on("click", "survey-points", (e) => {
    const f = e.features?.[0] as unknown as SurveyFeature | undefined;
    if (!f) return;
    new maplibregl.Popup({ offset: 12, maxWidth: "320px" })
      .setLngLat(e.lngLat)
      .setHTML(surveyPopupHtml(f.properties ?? {}))
      .addTo(map);
  });
  map.on("mouseenter", "survey-points", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "survey-points", () => {
    map.getCanvas().style.cursor = "";
  });
  const readout = document.getElementById("coord-readout");
  if (readout) {
    map.on("mousemove", (e) => {
      readout.textContent = `${e.lngLat.lat.toFixed(6)}, ${e.lngLat.lng.toFixed(6)}`;
    });
  }
  map.on("error", (e) =>
    setStatus(`map error: ${(e.error as Error)?.message ?? "unknown"}`),
  );

  document.querySelectorAll('input[name="basemap"]').forEach((input) => {
    input.addEventListener("change", () => {
      map.setStyle(styleUrl(MAPS[basemap()]), { diff: false });
      map.once("style.load", () => {
        addOverlays();
        if (naipVisible) void setNaip(true);
        setStatus(`map live — ${basemap()} + trails`);
      });
    });
  });

  (
    document.getElementById("toggle-trails") as HTMLInputElement
  ).addEventListener("change", (e) => {
    trailsVisible = (e.target as HTMLInputElement).checked;
    if (map.getLayer("trails-line")) {
      map.setLayoutProperty(
        "trails-line",
        "visibility",
        trailsVisible ? "visible" : "none",
      );
    }
  });

  (document.getElementById("toggle-naip") as HTMLInputElement).addEventListener(
    "change",
    (e) => {
      void setNaip((e.target as HTMLInputElement).checked);
    },
  );

  document.querySelectorAll("#course-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#course-tabs button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCourse = (btn as HTMLElement).dataset["course"] as CourseId;
      flyToCourse(currentCourse);
      void renderHoles(currentCourse);
      void refreshSurveyLayer();
    });
  });

  (document.getElementById("locate") as HTMLButtonElement).addEventListener(
    "click",
    () => {
      if (!navigator.geolocation) {
        setStatus("geolocation unavailable in this browser");
        return;
      }
      setStatus("locating…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          new maplibregl.Marker({ color: "#1f5c3f" })
            .setLngLat([longitude, latitude])
            .setPopup(new maplibregl.Popup().setText("you are here"))
            .addTo(map);
          const tiki = COURSES.tiki;
          const ft = haversineFt(latitude, longitude, tiki.lat, tiki.lon);
          const dist =
            ft > 5280 ? `${(ft / 5280).toFixed(1)} mi` : `${Math.round(ft)} ft`;
          setStatus(`you are ${dist} from the Tiki course`);
          map.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            essential: true,
          });
        },
        (err) => setStatus(`locate failed: ${err.message}`),
        { timeout: 10000 },
      );
    },
  );

  await renderHoles(currentCourse);
  wireScorecard();
  void renderFieldGallery();
  const wantHole = Number(params.get("hole"));
  if (Number.isInteger(wantHole) && wantHole >= 1) {
    const holeInput = document.getElementById(
      "score-hole",
    ) as HTMLInputElement | null;
    if (holeInput) holeInput.value = String(wantHole);
    flyToCourse(currentCourse);
    setStatus(
      `from the story page — ${currentCourse} hole ${wantHole} on the card`,
    );
  }
}

void main().catch((e: unknown) =>
  setStatus(`startup failed: ${(e as Error)?.message ?? e}`),
);
