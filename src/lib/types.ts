export type Phase = "lobby" | "hiding" | "hunting" | "finished" | "cancelled";
export type Role = "hider" | "seeker" | null;
export type Player = {
  id: string;
  name: string;
  role: Role;
  status: "lobby" | "active" | "eliminated" | "left";
  ready: boolean;
  connected: boolean;
  reason: string | null;
};
export type Settings = {
  hide_seconds: number;
  hunt_seconds: number;
  reveal_seconds: number;
  reveal_duration: number;
  shrink_seconds: number;
  radius: number;
  min_radius: number;
  shrink_factor: number;
  seekers_per: number;
  tag_distance: number;
  gps_grace: number;
  preset?: "auto" | "custom";
};
export type NumericSetting = Exclude<keyof Settings, "preset">;
export type Preset = {
  name: string;
  min: number;
  max: number;
  settings: Partial<Record<NumericSetting, number>>;
};
// The server owns the preset table and ships it with the lobby snapshot.
export function presetFor(
  presets: Preset[] | null | undefined,
  players: number,
) {
  return presets?.find((p) => players >= p.min && players <= p.max);
}
export const DEFAULT_SETTINGS: Settings = {
  hide_seconds: 300,
  hunt_seconds: 1800,
  reveal_seconds: 300,
  reveal_duration: 5,
  shrink_seconds: 360,
  radius: 400,
  min_radius: 60,
  shrink_factor: 0.7,
  seekers_per: 5,
  tag_distance: 20,
  gps_grace: 90,
};
export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};
export type Snapshot = {
  id: string;
  code: string;
  me: string;
  host: string;
  phase: Phase;
  settings: Settings;
  presets?: Preset[] | null;
  center: { lat: number; lng: number };
  radius: number;
  next_radius: number;
  phase_ends: string | null;
  ends_at: string | null;
  next_reveal: string | null;
  next_shrink: string | null;
  winner: string | null;
  version: number;
  server_time: string;
  players: Player[];
  reveals: { id: string; lat: number; lng: number; at: string }[];
  reveal_expires: string | null;
  tags: { id: string; seeker: string; hider: string; expires: string }[];
  events: { id: number; kind: string; message: string; at: string }[];
  gps_deadline: string | null;
};
export function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function countdown(time: string | null, now: number) {
  return time ? Math.max(0, Math.ceil((Date.parse(time) - now) / 1000)) : 0;
}
export function clock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function circle(
  lng: number,
  lat: number,
  meters: number,
): [number, number][] {
  return Array.from({ length: 97 }, (_, i) => {
    const angle = (i / 96) * Math.PI * 2;
    return [
      lng +
        (meters * Math.cos(angle)) / (111320 * Math.cos((lat * Math.PI) / 180)),
      lat + (meters * Math.sin(angle)) / 111320,
    ];
  });
}
