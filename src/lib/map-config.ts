import { setWorkerUrl } from "maplibre-gl";
// Bundlers break MapLibre's own worker URL; a copy is served from /public (see scripts/).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
// OpenFreeMap: free vector tiles built on OpenStreetMap data, no API key or quota.
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
// Repaint the OpenFreeMap dark style into the app's navy palette. Layer ids vary between
// style versions, so match by pattern and ignore properties a layer does not have.
import type { Map as LibreMap } from "maplibre-gl";
export function recolor(m: LibreMap) {
  const set = (id: string, prop: string, value: unknown) => {
    try {
      (
        m as unknown as {
          setPaintProperty: (i: string, p: string, v: unknown) => void;
        }
      ).setPaintProperty(id, prop, value);
    } catch {
      /* Layer lacks this property. */
    }
  };
  for (const l of m.getStyle().layers) {
    const id = l.id;
    if (l.type === "background") set(id, "background-color", "#0b1636");
    else if (l.type === "fill") {
      set(
        id,
        "fill-color",
        /water/.test(id)
          ? "#071029"
          : /park|wood|grass|forest|green|pitch|garden/.test(id)
            ? "#144a36"
            : /building/.test(id)
              ? "#1d4290"
              : "#12285a",
      );
      set(id, "fill-outline-color", "#12285a");
    } else if (l.type === "fill-extrusion") {
      set(id, "fill-extrusion-color", "#1d4290");
    } else if (l.type === "line") {
      set(
        id,
        "line-color",
        /water/.test(id)
          ? "#0a1a44"
          : /boundary/.test(id)
            ? "#3a5fa8"
            : /rail|aeroway/.test(id)
              ? "#2a4f9c"
              : "#2f5fb8",
      );
    } else if (l.type === "symbol") {
      set(id, "text-color", "#9bbcf0");
      set(id, "text-halo-color", "#0a1330");
      set(id, "text-halo-width", 1.5);
    }
  }
}
