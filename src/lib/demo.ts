import { DEFAULT_SETTINGS, Snapshot } from "./types";
export function demoGame(): Snapshot {
  const t = Date.now();
  return {
    id: "demo",
    code: "DEMO01",
    me: "you",
    host: "you",
    phase: "lobby",
    settings: {
      ...DEFAULT_SETTINGS,
      hide_seconds: 15,
      hunt_seconds: 180,
      reveal_seconds: 30,
      shrink_seconds: 45,
    },
    center: { lat: 40.7295, lng: -73.9965 },
    radius: 400,
    next_radius: 280,
    phase_ends: null,
    ends_at: null,
    next_reveal: null,
    next_shrink: null,
    winner: null,
    version: 1,
    server_time: new Date(t).toISOString(),
    players: [
      {
        id: "you",
        name: "You",
        role: null,
        status: "lobby",
        ready: false,
        connected: true,
        reason: null,
      },
      ...["Alex", "Jordan", "Sam", "Riley"].map((name, i) => ({
        id: `bot${i}`,
        name,
        role: null,
        status: "lobby" as const,
        ready: true,
        connected: true,
        reason: null,
      })),
    ],
    reveals: [],
    reveal_expires: null,
    tags: [],
    events: [],
    gps_deadline: null,
  };
}
const iso = (t: number) => new Date(t).toISOString();
export function advanceDemo(g: Snapshot, now: number): Snapshot {
  const s = structuredClone(g);
  if (s.phase === "hiding" && now >= Date.parse(s.phase_ends!)) {
    s.phase = "hunting";
    s.phase_ends = s.ends_at;
    s.events.unshift({
      id: now,
      kind: "hunt",
      message: "THE HUNT BEGINS",
      at: iso(now),
    });
  }
  if (s.phase === "hunting") {
    if (now >= Date.parse(s.ends_at!)) {
      s.phase = "finished";
      s.winner = "hiders";
      s.reveals = [];
      return s;
    }
    if (s.next_shrink && now >= Date.parse(s.next_shrink)) {
      s.radius = s.next_radius;
      s.next_radius = Math.max(s.settings.min_radius, s.radius * 0.7);
      s.next_shrink =
        s.radius <= s.settings.min_radius
          ? null
          : iso(Date.parse(s.next_shrink) + s.settings.shrink_seconds * 1000);
      s.events.unshift({
        id: now,
        kind: "zone",
        message: "ZONE CLOSED",
        at: iso(now),
      });
    }
    if (s.next_reveal && now >= Date.parse(s.next_reveal)) {
      const at = Date.parse(s.next_reveal);
      s.reveals = s.players
        .filter((p) => p.role === "hider" && p.status === "active")
        .map((p, i) => ({
          id: p.id,
          lat: s.center.lat + 0.0004 * (i + 1),
          lng: s.center.lng - 0.00035 * (i + 1),
          at: iso(at),
        }));
      s.reveal_expires = iso(at + 5000);
      s.next_reveal = iso(at + s.settings.reveal_seconds * 1000);
      s.events.unshift({
        id: now,
        kind: "reveal",
        message: "LOCATION REVEALED",
        at: iso(now),
      });
    }
    if (s.reveal_expires && now >= Date.parse(s.reveal_expires)) {
      s.reveals = [];
      s.reveal_expires = null;
    }
  }
  s.events = s.events.slice(0, 8);
  return s;
}
export function demoAction(
  g: Snapshot,
  action: string,
  data: Record<string, unknown>,
): Snapshot {
  const s = structuredClone(g),
    t = Date.now();
  if (action === "ready") s.players[0].ready = Boolean(data.ready);
  if (action === "settings") {
    s.settings = { ...s.settings, ...data };
    s.radius = s.settings.radius;
    s.next_radius = s.radius * 0.7;
  }
  if (action === "start") {
    s.phase = "hiding";
    s.players.forEach((p, i) => {
      p.role = i === 0 ? "seeker" : "hider";
      p.status = "active";
    });
    s.phase_ends = iso(t + s.settings.hide_seconds * 1000);
    s.ends_at = iso(
      t + (s.settings.hide_seconds + s.settings.hunt_seconds) * 1000,
    );
    s.next_reveal = iso(
      Date.parse(s.phase_ends) + s.settings.reveal_seconds * 1000,
    );
    s.next_shrink = iso(
      Date.parse(s.phase_ends) + s.settings.shrink_seconds * 1000,
    );
  }
  if (action === "tag") {
    const target = s.players.find(
      (p) => p.role === "hider" && p.status === "active",
    );
    if (target) {
      target.status = "eliminated";
      target.reason = "Practice tag";
      s.events.unshift({
        id: t,
        kind: "eliminated",
        message: `${target.name} · practice tag confirmed`,
        at: iso(t),
      });
    }
    if (!s.players.some((p) => p.role === "hider" && p.status === "active")) {
      s.phase = "finished";
      s.winner = "seekers";
    }
  }
  return s;
}
