import { setWorkerUrl } from "maplibre-gl";
// Bundlers break MapLibre's own worker URL; a copy is served from /public (see scripts/).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
// OpenFreeMap: free vector tiles built on OpenStreetMap data, no API key or quota.
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
