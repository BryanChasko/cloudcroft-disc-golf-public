#!/usr/bin/env node
// Copy versioned dataset JSON into the web bundle so the app serves
// same-origin data with zero extra requests config. Runs as prebuild.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  ["../dataset/trails.geojson", "public/data/osm/trails.geojson"],
  [
    "../dataset/byron-ligon-tiki.json",
    "public/data/holes/byron-ligon-tiki.json",
  ],
  [
    "../dataset/cloudcroft-community.json",
    "public/data/holes/cloudcroft-community.json",
  ],
  ["../dataset/course-area-grid.json", "public/data/dem/course-area-grid.json"],
  [
    "../dataset/anchor-elevations.json",
    "public/data/dem/anchor-elevations.json",
  ],
];
for (const [src, dst] of files) {
  const from = join(root, src);
  const to = join(root, dst);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`data: ${src} -> ${dst}`);
}
