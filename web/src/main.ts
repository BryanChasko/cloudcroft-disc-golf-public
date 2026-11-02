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
interface FieldPhoto {
  web_url: string;
  label: string;
  dist_m: number;
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
    field_photos?: FieldPhoto[];
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

// One navigable place index over every verified, geolocated thing the
// field day produced: SW Maps points (both courses) plus Pixel photos,
// panoramas, and the geolocated SW Maps screenshots in survey-assets.json.
// Assets without coordinates cannot be placed on the map and are counted,
// never given invented positions.
interface Place {
  id: string;
  group: string;
  kindLabel: string;
  label: string;
  lat: number;
  lon: number;
  course?: CourseId;
  hole?: number;
  image?: string;
  note?: string;
  meta?: string;
  panoId?: string;
  storyHash: string;
  survey?: SurveyFeature["properties"];
}
const places: Place[] = [];
const placesById = new Map<string, Place>();
let unlocatedAssets = 0;
let selectedPlaceId: string | null = null;
let activePopup: maplibregl.Popup | null = null;
let meMarker: maplibregl.Marker | null = null;

function coordText(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
function distText(ft: number): string {
  return ft > 5280 ? `${(ft / 5280).toFixed(1)} mi` : `${Math.round(ft)} ft`;
}
function nearestPano(lat: number, lon: number, maxFt: number): Place | null {
  let best: Place | null = null;
  let bestFt = maxFt;
  for (const p of places) {
    if (!p.panoId) continue;
    const ft = haversineFt(lat, lon, p.lat, p.lon);
    if (ft < bestFt) {
      best = p;
      bestFt = ft;
    }
  }
  return best;
}

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
  // Every photo taken at the point: the SW Maps attached shot plus the
  // nearest Pixel field photos from the same field day.
  const shots: { src: string; label: string }[] = [
    ...(p.photos_web ?? []).map((src) => ({
      src,
      label: `Survey photo at ${p.name ?? "survey point"}`,
    })),
    ...(p.field_photos ?? []).map((f) => ({ src: f.web_url, label: f.label })),
  ];
  const seen = new Set<string>();
  for (const s of shots) {
    if (seen.has(s.src)) continue;
    seen.add(s.src);
    bits.push(
      `<img class="pop-photo" src="${esc(s.src)}" alt="${esc(s.label)}" loading="lazy">`,
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
  const links: string[] = [];
  if (typeof p.lat === "number" && typeof p.lon === "number") {
    const pano = nearestPano(p.lat, p.lon, 250);
    if (pano?.panoId) {
      links.push(
        `<a href="./walk.html?pano=${encodeURIComponent(pano.panoId)}">stand near here in the 3D walk</a>`,
      );
    }
  }
  links.push(
    `<a href="/cloudcroft-disc-golf/#pts-table">this point in the story</a>`,
  );
  bits.push(`<span class="pop-links">${links.join(" · ")}</span>`);
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

async function loadPlaces(): Promise<void> {
  const select = document.getElementById(
    "place-select",
  ) as HTMLSelectElement | null;
  try {
    const [tiki, community, assetsData] = await Promise.all([
      holesFor("tiki"),
      holesFor("community"),
      (await fetch(DATA.surveyAssets)).json() as Promise<{
        assets: SurveyAsset[];
      }>,
    ]);
    places.length = 0;
    placesById.clear();
    for (const file of [community, tiki]) {
      for (const f of file.features ?? []) {
        if (f.geometry.type !== "Point") continue;
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        const lon = typeof p.lon === "number" ? p.lon : coords?.[0];
        const lat = typeof p.lat === "number" ? p.lat : coords?.[1];
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        if (!p.survey_id) continue;
        const meta: string[] = [];
        if (typeof p.elevation_m === "number")
          meta.push(`elev ${p.elevation_m.toFixed(1)} m`);
        if (typeof p.accuracy_h_m === "number")
          meta.push(`±${p.accuracy_h_m} m`);
        if (typeof p.averaging === "number")
          meta.push(`${p.averaging}-fix avg`);
        places.push({
          id: `survey:${p.survey_id}`,
          group: `Survey points — ${p.course === "tiki" ? "Tiki" : "Community"}`,
          kindLabel: `SW Maps ${p.kind ?? "point"}${p.hole ? ` · hole ${p.hole}` : ""}`,
          label: p.name ?? p.survey_id,
          lat,
          lon,
          course: (p.course as CourseId | undefined) ?? undefined,
          hole: p.hole,
          image: p.photos_web?.[0] ?? p.field_photos?.[0]?.web_url,
          note: p.note || undefined,
          meta: meta.join(" · ") || undefined,
          storyHash: "#pts-table",
          survey: p,
        });
      }
    }
    unlocatedAssets = 0;
    for (const a of assetsData.assets) {
      if (a.lat === null || a.lon === null) {
        unlocatedAssets += 1;
        continue;
      }
      places.push({
        id: `asset:${a.asset_id}`,
        group:
          a.kind === "pano"
            ? "Panoramas"
            : a.kind === "photo"
              ? "Pixel photos"
              : "SW Maps screenshots (geolocated)",
        kindLabel:
          a.kind === "pano"
            ? "360° panorama"
            : a.kind === "photo"
              ? "Pixel photo"
              : "SW Maps screenshot",
        label: a.label,
        lat: a.lat,
        lon: a.lon,
        image: a.web_url,
        panoId: a.pano_id,
        storyHash:
          a.kind === "pano"
            ? "#gal-panos"
            : a.kind === "photo"
              ? "#gal-photos"
              : "#pts-table",
      });
    }
    for (const p of places) placesById.set(p.id, p);
    if (select) {
      const groups = new Map<string, Place[]>();
      for (const p of places) {
        const list = groups.get(p.group) ?? [];
        list.push(p);
        groups.set(p.group, list);
      }
      select.innerHTML = `<option value="">Choose a point, photo, or panorama (${places.length} mapped)</option>`;
      for (const [group, list] of groups) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `${group} (${list.length})`;
        for (const p of list) {
          const option = document.createElement("option");
          option.value = p.id;
          option.textContent = `${p.label} — ${coordText(p.lat, p.lon)}`;
          optgroup.appendChild(option);
        }
        select.appendChild(optgroup);
      }
      if (selectedPlaceId) select.value = selectedPlaceId;
    }
    const detail = document.getElementById("place-detail");
    if (detail && !selectedPlaceId && unlocatedAssets > 0) {
      detail.innerHTML = `<p class="note">Every geolocated survey point, Pixel photo, and panorama from the field day, by its recorded coordinates. ${unlocatedAssets} SW Maps setup screenshots carry no coordinates, so they stay off the map rather than get invented positions.</p>`;
    }
  } catch {
    if (select) {
      select.innerHTML = `<option value="">Mapped points failed to load</option>`;
    }
  }
}

function placePopupHtml(p: Place): string {
  if (p.survey) return surveyPopupHtml(p.survey);
  const bits: string[] = [
    `<strong>${esc(p.label)}</strong>`,
    `<span class="pop-kind">${esc(p.kindLabel)}</span>`,
  ];
  if (p.image) {
    bits.push(
      `<img class="pop-photo" src="${esc(p.image)}" alt="${esc(p.label)}" loading="lazy">`,
    );
  }
  bits.push(`<span class="pop-coords">${coordText(p.lat, p.lon)}</span>`);
  const links: string[] = [];
  if (p.panoId) {
    links.push(
      `<a href="./walk.html?pano=${encodeURIComponent(p.panoId)}">stand here in the 3D walk</a>`,
    );
  }
  if (p.image) {
    links.push(`<a href="${esc(p.image)}">open full image</a>`);
  }
  links.push(
    `<a href="/cloudcroft-disc-golf/${p.storyHash}">see it in the story</a>`,
  );
  bits.push(`<span class="pop-links">${links.join(" · ")}</span>`);
  return bits.join("<br>");
}

function renderPlaceDetail(p: Place): void {
  const host = document.getElementById("place-detail");
  if (!host) return;
  const walk = p.panoId
    ? `<a href="./walk.html?pano=${encodeURIComponent(p.panoId)}">Stand here in the 3D walk</a>`
    : (() => {
        const pano = nearestPano(p.lat, p.lon, 250);
        return pano?.panoId
          ? `<a href="./walk.html?pano=${encodeURIComponent(pano.panoId)}">Nearest panorama in the 3D walk</a>`
          : "";
      })();
  host.innerHTML =
    `<p class="place-title"><strong>${esc(p.label)}</strong></p>` +
    `<p class="note">${esc(p.kindLabel)}${p.course ? ` · ${esc(COURSES[p.course].name)}` : ""}</p>` +
    `<p class="pop-coords">${coordText(p.lat, p.lon)}</p>` +
    (p.note ? `<p>${esc(p.note)}</p>` : "") +
    (p.meta ? `<p class="note">${esc(p.meta)}</p>` : "") +
    (p.image
      ? `<a href="${esc(p.image)}"><img class="place-thumb" src="${esc(p.image)}" alt="${esc(p.label)}" loading="lazy"></a>`
      : "") +
    `<p class="place-links">${[walk, `<a href="/cloudcroft-disc-golf/${p.storyHash}">In the story</a>`].filter(Boolean).join(" · ")}</p>`;
}

function syncCourseTabs(): void {
  document.querySelectorAll("#course-tabs button").forEach((b) => {
    const active = (b as HTMLElement).dataset["course"] === currentCourse;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}

function markSelectedHoleRow(): void {
  const selected = selectedPlaceId
    ? placesById.get(selectedPlaceId)
    : undefined;
  document.querySelectorAll<HTMLElement>("#holes tbody tr").forEach((tr) => {
    const isCurrent =
      selected?.course === currentCourse &&
      selected.hole !== undefined &&
      Number(tr.dataset["hole"]) === selected.hole;
    tr.classList.toggle("selected", isCurrent);
    if (isCurrent) tr.setAttribute("aria-current", "true");
    else tr.removeAttribute("aria-current");
  });
}

interface SelectOptions {
  fly?: boolean;
  popup?: boolean;
  updateUrl?: boolean;
  holeBounds?: boolean;
}

function selectPlace(id: string, opts: SelectOptions = {}): void {
  const p = placesById.get(id);
  if (!p) return;
  selectedPlaceId = id;
  if (p.course && p.course !== currentCourse) {
    currentCourse = p.course;
    syncCourseTabs();
    void renderHoles(currentCourse);
    void refreshSurveyLayer();
  }
  const select = document.getElementById(
    "place-select",
  ) as HTMLSelectElement | null;
  if (select && select.value !== id) select.value = id;
  renderPlaceDetail(p);
  markSelectedHoleRow();

  const src = map?.getSource("selected-place") as
    maplibregl.GeoJSONSource | undefined;
  src?.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { label: p.label },
      },
    ],
  } as never);

  if (opts.fly !== false && map) {
    const holePlaces =
      opts.holeBounds && p.hole !== undefined && p.course
        ? places.filter((q) => q.course === p.course && q.hole === p.hole)
        : [];
    if (holePlaces.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const q of holePlaces) bounds.extend([q.lon, q.lat]);
      map.fitBounds(bounds, { padding: 90, maxZoom: 17, essential: true });
    } else {
      map.flyTo({ center: [p.lon, p.lat], zoom: 17, essential: true });
    }
  }
  if (opts.popup !== false && map) {
    activePopup?.remove();
    activePopup = new maplibregl.Popup({ offset: 14, maxWidth: "320px" })
      .setLngLat([p.lon, p.lat])
      .setHTML(placePopupHtml(p))
      .addTo(map);
  }
  if (opts.updateUrl !== false) {
    const url = new URL(location.href);
    url.searchParams.set("place", id);
    if (p.course) url.searchParams.set("course", p.course);
    if (p.hole) url.searchParams.set("hole", String(p.hole));
    else url.searchParams.delete("hole");
    history.replaceState(null, "", url);
  }
  setStatus(`${p.kindLabel}: ${p.label} — ${coordText(p.lat, p.lon)}`);
}

function selectHole(courseId: CourseId, hole: number): void {
  const candidates = places.filter(
    (p) => p.course === courseId && p.hole === hole,
  );
  const target =
    candidates.find((p) => p.survey?.kind === "tee") ?? candidates[0];
  if (target) {
    selectPlace(target.id, { holeBounds: true });
    return;
  }
  if (courseId !== currentCourse) {
    currentCourse = courseId;
    syncCourseTabs();
    void renderHoles(currentCourse);
    void refreshSurveyLayer();
  }
  selectedPlaceId = null;
  flyToCourse(courseId);
  setStatus(
    `hole ${hole} has no verified GPS point yet — showing the course area`,
  );
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
      const showOnMap =
        a.lat !== null && a.lon !== null
          ? ` <button type="button" class="show-on-map" data-place="asset:${esc(a.asset_id)}">Show on map</button>`
          : "";
      return `<figure>${href ? `<a href="${href}">${img}</a>` : img}<figcaption>${esc(a.label)}${coords}${showOnMap}</figcaption></figure>`;
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

  // Field-day imagery as its own markers: every Pixel photo + pano from
  // survey-assets.json, so the map shows all 15 photos and 6 panos where
  // the phone actually took them — not just the point they annotate.
  if (!map.getSource("field-shots")) {
    map.addSource("field-shots", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "field-photos",
      type: "circle",
      source: "field-shots",
      filter: ["==", ["get", "kind"], "photo"],
      paint: {
        "circle-radius": 4,
        "circle-color": "#b34700",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
      },
    });
    map.addLayer({
      id: "field-panos",
      type: "circle",
      source: "field-shots",
      filter: ["==", ["get", "kind"], "pano"],
      paint: {
        "circle-radius": 7,
        "circle-color": "#00838f",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "field-screens",
      type: "circle",
      source: "field-shots",
      filter: ["==", ["get", "kind"], "screenshot"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#616161",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
  }
  void refreshFieldShots();

  // Selected-place halo: one clear ring, whatever way the place was
  // chosen (map click, Map points list, hole row, gallery, deep link).
  if (!map.getSource("selected-place")) {
    map.addSource("selected-place", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "selected-place-halo",
      type: "circle",
      source: "selected-place",
      paint: {
        "circle-radius": 15,
        "circle-color": "#ff6d00",
        "circle-opacity": 0.18,
        "circle-stroke-color": "#ff6d00",
        "circle-stroke-width": 2.5,
      },
    });
    if (selectedPlaceId) {
      const p = placesById.get(selectedPlaceId);
      if (p) selectPlace(p.id, { fly: false, popup: false, updateUrl: false });
    }
  }

  // Point labels at close zoom, reusing whatever font the basemap style
  // itself ships so no font is invented. Skipped if the style has none.
  const styleFont = (() => {
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type !== "symbol") continue;
      const font = (layer.layout as Record<string, unknown> | undefined)?.[
        "text-font"
      ];
      if (Array.isArray(font) && font.length) return font as string[];
    }
    return null;
  })();
  if (styleFont) {
    const labelLayer = (
      id: string,
      source: string,
      color: string,
      filter?: unknown[],
    ) => {
      if (map.getLayer(id)) return;
      map.addLayer({
        id,
        type: "symbol",
        source,
        ...(filter ? { filter: filter as never } : {}),
        minzoom: 16,
        layout: {
          "text-field": ["get", "nav_label"],
          "text-font": styleFont,
          "text-size": 11,
          "text-offset": [0.7, 0],
          "text-anchor": "left",
          "text-max-width": 14,
          "text-optional": true,
        },
        paint: {
          "text-color": color,
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      } as never);
    };
    labelLayer("survey-labels", "survey", "#143d2a", [
      "==",
      ["geometry-type"],
      "Point",
    ]);
    labelLayer("field-shot-labels", "field-shots", "#7a2e00");
  }

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
      features: (data.features ?? []).map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          nav_label:
            f.geometry.type === "Point"
              ? (f.properties.name ?? f.properties.survey_id ?? "")
              : "",
        },
      })) as never[],
    });
  } catch {
    // leave prior features in place; table render reports failures
  }
}

async function refreshFieldShots(): Promise<void> {
  const src = map?.getSource("field-shots") as
    maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  try {
    const data = (await (await fetch(DATA.surveyAssets)).json()) as {
      assets: SurveyAsset[];
    };
    src.setData({
      type: "FeatureCollection",
      features: data.assets
        .filter((a) => a.lat !== null && a.lon !== null)
        .map((a) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [a.lon, a.lat] },
          properties: {
            kind: a.kind,
            asset_id: a.asset_id,
            label: a.label,
            nav_label:
              a.label.length > 30 ? `${a.label.slice(0, 29)}…` : a.label,
            web_url: a.web_url,
            pano_id: a.pano_id ?? null,
            lat: a.lat,
            lon: a.lon,
          },
        })) as never[],
    });
  } catch {
    // gallery render reports failures; markers stay empty
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
      tr.dataset["hole"] = String(h.hole);
      tr.innerHTML = `<td><button type="button" class="hole-go" aria-label="Show hole ${h.hole} on the map">${h.hole}</button></td><td>${par}</td><td>${dist}${h.note ? ` (${esc(h.note)})` : ""}</td><td><span class="status-chip">${label}</span></td>`;
      tr.title = h.par_source
        ? `par source: ${h.par_source}`
        : "show this hole on the map";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        selectHole(courseId, h.hole);
      });
      tbody.appendChild(tr);
    }
    markSelectedHoleRow();
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
    syncCourseTabs();
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
  // Map clicks select through the same place index as the Map points
  // list, so coords, halo, detail card, and URL always agree. GeoJSON
  // query results stringify nested properties, so look the intact place
  // up by id instead of trusting feature.properties. Registered once;
  // addOverlays re-runs on style swap and must not duplicate.
  map.on("click", "survey-points", (e) => {
    const surveyId = (
      e.features?.[0]?.properties as { survey_id?: string } | undefined
    )?.survey_id;
    if (surveyId) selectPlace(`survey:${surveyId}`, { fly: false });
  });
  const shotClick = (
    e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] },
  ) => {
    const assetId = (
      e.features?.[0]?.properties as { asset_id?: string } | undefined
    )?.asset_id;
    if (assetId) selectPlace(`asset:${assetId}`, { fly: false });
  };
  map.on("click", "field-photos", shotClick);
  map.on("click", "field-panos", shotClick);
  map.on("click", "field-screens", shotClick);
  for (const layer of [
    "survey-points",
    "field-photos",
    "field-panos",
    "field-screens",
  ]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
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

  (
    document.getElementById("toggle-shots") as HTMLInputElement
  ).addEventListener("change", (e) => {
    const vis = (e.target as HTMLInputElement).checked ? "visible" : "none";
    for (const layer of [
      "field-photos",
      "field-panos",
      "field-screens",
      "field-shot-labels",
    ]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", vis);
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
      currentCourse = (btn as HTMLElement).dataset["course"] as CourseId;
      syncCourseTabs();
      flyToCourse(currentCourse);
      void renderHoles(currentCourse);
      void refreshSurveyLayer();
    });
  });

  // Map points navigator: the keyboard-accessible path to every mapped
  // place, including points that share a coordinate on the map.
  document.getElementById("place-select")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    if (id) selectPlace(id);
  });
  document.getElementById("mountaintop-go")?.addEventListener("click", () => {
    const target =
      placesById.get("survey:community-18") ??
      places.find((p) => p.panoId === "tee2-area");
    if (target) selectPlace(target.id);
  });
  document.getElementById("field-gallery")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      "button[data-place]",
    );
    if (!btn?.dataset["place"]) return;
    selectPlace(btn.dataset["place"]);
    document
      .getElementById("map")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          const { latitude, longitude, accuracy } = pos.coords;
          if (!meMarker) {
            meMarker = new maplibregl.Marker({ color: "#1f5c3f" });
          }
          meMarker
            .setLngLat([longitude, latitude])
            .setPopup(
              new maplibregl.Popup().setText(
                `you are here — ${coordText(latitude, longitude)}`,
              ),
            )
            .addTo(map);
          let nearest: Place | null = null;
          let nearestFt = Infinity;
          for (const p of places) {
            const ft = haversineFt(latitude, longitude, p.lat, p.lon);
            if (ft < nearestFt) {
              nearest = p;
              nearestFt = ft;
            }
          }
          setStatus(
            nearest
              ? `you are ${distText(nearestFt)} from ${nearest.label} (nearest mapped point${accuracy ? `; fix ±${Math.round(accuracy)} m` : ""}) — pick it under Map points`
              : `you are at ${coordText(latitude, longitude)}`,
          );
          map.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            essential: true,
          });
        },
        (err) => setStatus(`locate failed: ${err.message}`),
        { timeout: 10000 },
      );
    },
  );

  await Promise.all([renderHoles(currentCourse), loadPlaces()]);
  wireScorecard();
  void renderFieldGallery();
  markSelectedHoleRow();
  // Deep links, in priority order: ?place=survey:…|asset:… (written by
  // this page on every selection), ?pano=<pano id>, then the story
  // page's ?course=…&hole=… — which now lands on the hole's verified
  // tee/basket points instead of the coarse course anchor.
  const applyDeepLink = () => {
    const wantPlace = params.get("place");
    if (wantPlace && placesById.has(wantPlace)) {
      selectPlace(wantPlace);
      return;
    }
    const wantPano = params.get("pano");
    const panoPlace = wantPano
      ? places.find((p) => p.panoId === wantPano)
      : undefined;
    if (panoPlace) {
      selectPlace(panoPlace.id);
      return;
    }
    const wantHole = Number(params.get("hole"));
    if (Number.isInteger(wantHole) && wantHole >= 1) {
      const holeInput = document.getElementById(
        "score-hole",
      ) as HTMLInputElement | null;
      if (holeInput) holeInput.value = String(wantHole);
      selectHole(currentCourse, wantHole);
    }
  };
  if (map.loaded()) applyDeepLink();
  else map.once("load", applyDeepLink);
}

void main().catch((e: unknown) =>
  setStatus(`startup failed: ${(e as Error)?.message ?? e}`),
);
