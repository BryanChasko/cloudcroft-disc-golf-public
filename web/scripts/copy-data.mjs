#!/usr/bin/env node
// Copy versioned dataset JSON into the web bundle so the app serves
// same-origin data with zero extra requests config. Runs as prebuild.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
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
  [
    "../dataset/naip-course-window.jpg",
    "public/data/naip/course-area-naip.jpg",
  ],
  [
    "../dataset/naip-course-window.jpg.json",
    "public/data/naip/course-area-naip.jpg.json",
  ],
  ["../dataset/survey-assets.json", "public/data/survey-assets.json"],
  ...readdirSync(join(root, "../dataset/panos-web"))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => [`../dataset/panos-web/${f}`, `public/data/panos/${f}`]),
  // WebP derivatives from dataset/scripts/web_assets.py
  ...["photos", "screenshots"].flatMap((sub) =>
    readdirSync(join(root, `../dataset/web-assets/${sub}`))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => [
        `../dataset/web-assets/${sub}/${f}`,
        `public/data/${sub}/${f}`,
      ]),
  ),
];
for (const [src, dst] of files) {
  const from = join(root, src);
  const to = join(root, dst);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`data: ${src} -> ${dst}`);
}
