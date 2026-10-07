"use client";
import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE } from "@/lib/map-config";
import { circle } from "@/lib/types";
const feature = (lng: number, lat: number, meters: number) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [circle(lng, lat, meters)],
  },
});
// Non-interactive map of the play area with the starting and final safe zones drawn on it,
// so the host can judge how big a radius really is before saving.
export default function RadiusPreview({
  center,
  radius,
  minRadius,
}: {
  center: { lat: number; lng: number };
  radius: number;
  minRadius: number;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null);
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const start = useRef({ center, radius });
  useEffect(() => {
    if (!el.current) return;
    let m: LibreMap;
    try {
      m = new LibreMap({
        container: el.current,
        style: MAP_STYLE,
        center: [start.current.center.lng, start.current.center.lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = m;
    m.on("load", () => {
      for (const id of ["outer", "inner"])
        m.addSource(id, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      m.addLayer({
        id: "outer-fill",
        type: "fill",
        source: "outer",
        paint: { "fill-color": "#bce76b", "fill-opacity": 0.1 },
      });
      m.addLayer({
        id: "outer-line",
        type: "line",
        source: "outer",
        paint: { "line-color": "#c5f45c", "line-width": 2.5 },
      });
      m.addLayer({
        id: "inner-line",
        type: "line",
        source: "inner",
        paint: {
          "line-color": "#e9f4ce",
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });
      setLoaded(true);
    });
    m.on("error", () => setFailed(true));
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const outer = Math.max(20, Number(radius) || 0),
      inner = Math.min(outer, Math.max(10, Number(minRadius) || 0));
    (m.getSource("outer") as GeoJSONSource).setData(
      feature(center.lng, center.lat, outer),
    );
    (m.getSource("inner") as GeoJSONSource).setData(
      feature(center.lng, center.lat, inner),
    );
    const ring = circle(center.lng, center.lat, outer);
    const lngs = ring.map((p) => p[0]),
      lats = ring.map((p) => p[1]);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: 28,
        maxZoom: 19,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 250,
      },
    );
  }, [center, radius, minRadius, loaded]);
  return (
    <div className="radius-preview">
      <div ref={el} className="preview-map" />
      {failed && <div className="preview-note">Map preview unavailable.</div>}
    </div>
  );
}
