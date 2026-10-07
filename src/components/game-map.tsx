"use client";
import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, Map as LibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed } from "lucide-react";
import { Snapshot, Fix, circle } from "@/lib/types";
// OpenFreeMap: free vector tiles built on OpenStreetMap data, no API key or quota.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
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
    map = useRef<LibreMap | null>(null);
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(game);
  useEffect(() => {
    if (!el.current) return;
    const g = initial.current;
    let m: LibreMap;
    try {
      m = new LibreMap({
        container: el.current,
        style: MAP_STYLE,
        center: [g.center.lng, g.center.lat],
        zoom: 15,
        attributionControl: { compact: true },
        maxZoom: 19,
      });
      map.current = m;
      m.on("load", () => {
        for (const id of ["zone", "next", "players"])
          m.addSource(id, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        m.addLayer({
          id: "zone-fill",
          type: "fill",
          source: "zone",
          paint: { "fill-color": "#bce76b", "fill-opacity": 0.08 },
        });
        m.addLayer({
          id: "zone-line",
          type: "line",
          source: "zone",
          paint: { "line-color": "#c5f45c", "line-width": 2.5 },
        });
        m.addLayer({
          id: "next-line",
          type: "line",
          source: "next",
          paint: {
            "line-color": "#e9f4ce",
            "line-width": 1.5,
            "line-dasharray": [3, 4],
            "line-opacity": 0.5,
          },
        });
        m.addLayer({
          id: "players-halo",
          type: "circle",
          source: "players",
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 18,
            "circle-opacity": 0.18,
          },
        });
        m.addLayer({
          id: "players-dot",
          type: "circle",
          source: "players",
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
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
    const features = [
      ...(own
        ? [
            {
              type: "Feature" as const,
              properties: { color: "#c5f45c" },
              geometry: {
                type: "Point" as const,
                coordinates: [own.lng, own.lat],
              },
            },
          ]
        : []),
      ...(valid
        ? game.reveals.map((p) => ({
            type: "Feature" as const,
            properties: { color: "#ffa778" },
            geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          }))
        : []),
    ];
    (m.getSource("players") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
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
        className="recenter icon-button"
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
        <LocateFixed size={21} />
      </button>
    </>
  );
}
