"use client";
import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  GeoJSONSource,
  Map as LibreMap,
  Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed } from "lucide-react";
import { Snapshot, Fix, circle } from "@/lib/types";
import { MAP_STYLE, recolor } from "@/lib/map-config";
import { DOT, STAR, badgeRows, svgMarkup } from "@/lib/pixel-art";
const pinHtml = (fill: string, glyph: string[], glyphColor: string) =>
  svgMarkup(badgeRows(glyph), { o: "#060d22", f: fill, g: glyphColor }, 4);
export default function GameMap({
  game,
  fix,
  now,
}: {
  game: Snapshot;
  fix: Fix | null;
  now: number;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    pins = useRef(new Map<string, Marker>());
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(game);
  useEffect(() => {
    if (!el.current) return;
    const g = initial.current;
    const placed = pins.current;
    let m: LibreMap;
    try {
      m = new LibreMap({
        container: el.current,
        style: MAP_STYLE,
        center: [g.center.lng, g.center.lat],
        zoom: 15,
        attributionControl: false,
        maxZoom: 19,
      });
      map.current = m;
      m.addControl(new AttributionControl({ compact: true }), "top-left");
      m.on("load", () => {
        recolor(m);
        for (const id of ["zone", "next"])
          m.addSource(id, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        m.addLayer({
          id: "zone-fill",
          type: "fill",
          source: "zone",
          paint: { "fill-color": "#7fe7ff", "fill-opacity": 0.08 },
        });
        m.addLayer({
          id: "zone-line",
          type: "line",
          source: "zone",
          paint: { "line-color": "#7fe7ff", "line-width": 3 },
        });
        m.addLayer({
          id: "next-line",
          type: "line",
          source: "next",
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [2, 2],
            "line-opacity": 0.8,
          },
        });
        setLoaded(true);
      });
      m.on("error", () => setFailed(true));
    } catch {
      setFailed(true);
      return;
    }
    return () => {
      for (const pin of placed.values()) pin.remove();
      placed.clear();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const seconds = game.next_shrink
      ? (Date.parse(game.next_shrink) - now) / 1000
      : Infinity;
    const progress = Math.max(
      0,
      Math.min(1, 1 - seconds / Math.min(60, game.settings.shrink_seconds)),
    );
    const radius =
      game.phase === "hunting"
        ? game.radius + (game.next_radius - game.radius) * progress
        : game.radius;
    for (const [id, r] of [
      ["zone", radius],
      ["next", game.next_radius],
    ] as const)
      (m.getSource(id) as GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [circle(game.center.lng, game.center.lat, r)],
        },
      });
    const own =
      fix ??
      (game.id === "demo"
        ? { lat: game.center.lat, lng: game.center.lng }
        : null);
    const valid = game.reveal_expires && Date.parse(game.reveal_expires) > now;
    const wanted = new Map<
      string,
      { lat: number; lng: number; html: string; label: string }
    >();
    if (own)
      wanted.set("you", {
        ...own,
        html: pinHtml("#ffffff", DOT, "#2d86c4"),
        label: "You",
      });
    if (valid)
      for (const p of game.reveals)
        wanted.set(`reveal-${p.id}`, {
          lat: p.lat,
          lng: p.lng,
          html: pinHtml("#ff9a2f", STAR, "#ffffff"),
          label: "Hider, where they were at the last reveal",
        });
    const placed = pins.current;
    for (const [key, pin] of placed)
      if (!wanted.has(key)) {
        pin.remove();
        placed.delete(key);
      }
    for (const [key, w] of wanted) {
      const existing = placed.get(key);
      if (existing) existing.setLngLat([w.lng, w.lat]);
      else {
        const node = document.createElement("div");
        node.className = "pin";
        node.setAttribute("role", "img");
        node.setAttribute("aria-label", w.label);
        node.innerHTML = w.html;
        placed.set(
          key,
          new Marker({ element: node }).setLngLat([w.lng, w.lat]).addTo(m),
        );
      }
    }
  }, [game, fix, now, loaded]);
  return (
    <>
      <div ref={el} className="live-map" />
      {failed && (
        <div className="map-warning">
          Map tiles unavailable. Game status stays active.
        </div>
      )}
      <button
        className="recenter icon-button small"
        aria-label="Center map on my location"
        onClick={() =>
          map.current?.easeTo({
            center: fix
              ? [fix.lng, fix.lat]
              : [game.center.lng, game.center.lat],
            duration: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? 0
              : 250,
          })
        }
      >
        <LocateFixed size={20} strokeWidth={3} />
      </button>
    </>
  );
}
