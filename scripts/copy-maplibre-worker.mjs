// MapLibre v6 builds its worker from import.meta.url, which bundlers rewrite to an
// unusable file:// path. Serve the worker files ourselves and point MapLibre at them.
import { cpSync, mkdirSync } from "node:fs";
const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  cpSync(`${from}/${f}`, `${to}/${f}`);
