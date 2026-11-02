// Public, committable config. The Cognito guest pool grants only scoped
// read access to our Location resources + tracker writes (see infra-cdk).
export const REGION = "us-east-1";
export const IDENTITY_POOL_ID =
  "us-east-1:6f67bf3e-988c-491a-ab4c-b89211a7f82d";
export const API_BASE =
  "https://sfss0zmepi.execute-api.us-east-1.amazonaws.com";
export const MAPS = {
  topo: "cloudcroft-disc-golf-topo",
  imagery: "cloudcroft-disc-golf-imagery",
} as const;
export type Basemap = keyof typeof MAPS;

export const COURSES = {
  tiki: {
    name: "Byron Ligon Memorial Tiki DGC",
    lon: -105.73887,
    lat: 32.95787,
    eleFt: 8664.5,
    blurb: "9 holes · par 27 · 901 ft · all putters under aspen and doug fir",
    holesUrl: "data/holes/byron-ligon-tiki.json",
  },
  community: {
    name: "Cloudcroft Community DGC",
    lon: -105.73996,
    lat: 32.9632,
    eleFt: 8781.4,
    blurb: "18 holes · par 63 · wooded mountain course, opened 2019",
    holesUrl: "data/holes/cloudcroft-community.json",
  },
} as const;
export type CourseId = keyof typeof COURSES;

export interface PanoView {
  id: string;
  lot: "kiosk" | "tee" | "basket" | "vista";
  label: string;
  file: string;
  lon: number;
  lat: number;
  course: CourseId;
  note: string;
  /** initial look direction (radians); verified per pano on screen */
  yaw?: number;
}
export const PANOS: PanoView[] = [
  {
    id: "basket1",
    lot: "basket",
    label: "Community Hole 1 — basket 1",
    file: "data/panos/PXL_20261101_171610748.webp",
    lon: -105.742064,
    lat: 32.961281,
    course: "community",
    note: "Basket 1 area — a real 360° shot from the November 1 ground survey. Drag to look around.",
  },
  {
    // Shot + GPS both read Hole 1: the north-cluster 360 at the Hole 1
    // tee area (mislabeled tee2 before the Nov 2026 mountaintop fix).
    id: "tee1-area",
    lot: "tee",
    label: "Community Hole 1 — tee box 1, par 4, 411 ft",
    file: "data/panos/PXL_20261101_170324214.webp",
    lon: -105.742392,
    lat: 32.962347,
    course: "community",
    note: "North-cluster 360° at the Hole 1 tee area — a real shot from the November 1 ground survey. Pro-par 4, 411 ft uphill. Drag to look around.",
    yaw: 1.6,
  },
  {
    id: "basket2",
    lot: "basket",
    label: "Community Hole 2 — basket 2",
    file: "data/panos/PXL_20261101_173918101.webp",
    lon: -105.741778,
    lat: 32.962383,
    course: "community",
    note: "Basket 2 area — a real 360° shot from the November 1 ground survey. Drag to look around.",
  },
  {
    id: "tee2-area",
    lot: "tee",
    label: "Community tee box 2 — Hole 2, par 3, 245 ft",
    file: "data/panos/PXL_20261101_173005849.webp",
    lon: -105.741683,
    lat: 32.961722,
    course: "community",
    note: "Mountaintop 360° at the Community tee box 2 pad — a real shot from the November 1 ground survey. Par 3, 245 ft, mando right. Drag to look around.",
    // Verified tee-2 compass fix — same heading as MOUNTAINTOP below.
    yaw: -2.72,
  },
  {
    id: "tiki-aspen",
    lot: "vista",
    label: "Byron Ligon Hole 3 — fairway 3, aspen grove",
    file: "data/panos/PXL_20261101_180216070.webp",
    lon: -105.738531,
    lat: 32.956922,
    course: "tiki",
    note: "Aspen grove at the Byron Ligon Tiki course — a real 360° shot from the November 1 ground survey. Drag to look around.",
  },
  {
    id: "tiki-vista",
    lot: "vista",
    label: "Byron Ligon Hole 3 — tee box 3",
    file: "data/panos/PXL_20261101_175756282.webp",
    lon: -105.738344,
    lat: 32.956939,
    course: "tiki",
    note: "South-area vista at the Byron Ligon Tiki course — a real 360° shot from the November 1 ground survey. Drag to look around.",
  },
];
export interface Mountaintop {
  course: CourseId;
  lon: number;
  lat: number;
  /** initial walk look direction (radians); from the tee-2 compass fix. */
  yaw: number;
  name: string;
  note: string;
}
// The mountaintop is the highest surveyed pad: Community tee box 2
// (SW Maps 40-fix average, elev 2675.3 m). Its 360° (tee2-area,
// PXL_20261101_173005849) was ingested 2026-11-02 — the walk jumps
// straight to that pano.
export const MOUNTAINTOP: Mountaintop = {
  course: "community",
  lon: -105.741698,
  lat: 32.961718125,
  yaw: -2.72,
  name: "Community tee box 2",
  note: "par 3, 245 ft — mando right, fence-line out of bounds right",
};

export const DATA = {
  trails: "data/osm/trails.geojson",
  naip: "data/naip/course-area-naip.jpg",
  naipMeta: "data/naip/course-area-naip.jpg.json",
  surveyAssets: "data/survey-assets.json",
};
