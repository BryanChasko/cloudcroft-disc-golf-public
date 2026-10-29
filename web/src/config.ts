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

export const DATA = {
  trails: "data/osm/trails.geojson",
  naip: "https://bryanchasko.com/disc-golf/data/naip/course-area-naip.jpg",
  naipMeta:
    "https://bryanchasko.com/disc-golf/data/naip/course-area-naip.jpg.json",
};
