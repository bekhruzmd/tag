"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  LogOut,
  MapPin,
  Radio,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { Snapshot, Settings, NumericSetting, presetFor } from "@/lib/types";
import { Brand } from "./home";
const RadiusPreview = dynamic(() => import("./radius-preview"), {
  ssr: false,
  loading: () => <div className="radius-preview" />,
});
export default function Lobby({
  game,
  busy,
  act,
  leave,
}: {
  game: Snapshot;
  busy: boolean;
  act: (a: string, d?: Record<string, unknown>) => Promise<boolean>;
  leave: () => Promise<void>;
}) {
  const me = game.players.find((p) => p.id === game.me)!;
  const host = game.host === me.id;
  const [locationMessage, setLocationMessage] = useState(""),
    [checking, setChecking] = useState(false),
    [copied, setCopied] = useState(false),
    [editing, setEditing] = useState(false),
    [settings, setSettings] = useState(game.settings);
  const ready = game.players.filter((p) => p.ready).length;
  // Asking inside a tap is what makes phones show the permission prompt reliably, and it
  // surfaces blocked permission or an insecure (http) page now rather than at game start.
  const toggleReady = () => {
    if (me.ready || game.id === "demo")
      return void act("ready", { ready: !me.ready });
    setLocationMessage("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationMessage(
        "Location only works on a secure https:// page. Open the game from its https link, not an IP address.",
      );
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setChecking(false);
        void act("ready", { ready: true });
      },
      (e) => {
        setChecking(false);
        setLocationMessage(
          e.code === 1
            ? "Location is blocked for this site. iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using the App (or tap aA in the address bar → Website Settings → Location → Allow). Android: tap the lock icon in the address bar → Permissions → Location → Allow. Then reload and tap I’m ready again."
            : "Couldn’t get a GPS fix yet. Step outside or near a window, then tap I’m ready again.",
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const seekerCount = Math.min(
    game.players.length - 1,
    Math.ceil(game.players.length / game.settings.seekers_per),
  );
  // "Auto" sizes the game for the final head count when the host starts, so show that.
  const players = game.players.length;
  const autoTier = presetFor(game.presets, players);
  const shown: Settings =
    game.settings.preset === "auto" && autoTier
      ? { ...game.settings, ...autoTier.settings }
      : game.settings;
  const fields: {
    key: NumericSetting;
    label: string;
    min: number;
    max: number;
    unit: string;
  }[] = [
    {
      key: "hide_seconds",
      label: "Head start",
      min: 15,
      max: 600,
      unit: "seconds",
    },
    {
      key: "hunt_seconds",
      label: "Hunt duration",
      min: 60,
      max: 7200,
      unit: "seconds",
    },
    {
      key: "radius",
      label: "Starting radius",
      min: 50,
      max: 2000,
      unit: "meters",
    },
    {
      key: "min_radius",
      label: "Final radius",
      min: 20,
      max: 2000,
      unit: "meters",
    },
    {
      key: "reveal_seconds",
      label: "Reveal interval",
      min: 20,
      max: 900,
      unit: "seconds",
    },
    {
      key: "reveal_duration",
      label: "Reveal duration",
      min: 1,
      max: 10,
      unit: "seconds",
    },
    {
      key: "shrink_seconds",
      label: "Shrink interval",
      min: 30,
      max: 900,
      unit: "seconds",
    },
    {
      key: "seekers_per",
      label: "One seeker per",
      min: 2,
      max: 15,
      unit: "players",
    },
    {
      key: "tag_distance",
      label: "Tag distance",
      min: 5,
      max: 50,
      unit: "meters",
    },
  ];
  return (
    <div className="room-shell">
      <header className="site-header">
        <Brand />
        <button className="text-button muted" onClick={() => void leave()}>
          <LogOut size={16} />
          Leave lobby
        </button>
      </header>
      <main className="lobby-main">
        <div className="lobby-intro">
          <div>
            <div className="eyebrow">
              <span className="status-dot" />
              {game.id === "demo"
                ? "PRACTICE · SIMULATED PLAYERS"
                : "THE PRE-GAME"}
            </div>
            <h1>
              Assemble the crew<span>.</span>
            </h1>
            <p>Meet at the play area. Ready up. Let the chase begin.</p>
          </div>
          <div className="room-code">
            <span>YOUR ROOM CODE</span>
            <button
              aria-label="Copy room code"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(game.code)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
            >
              {game.code}
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <small>
              {copied
                ? "Copied. Send it to your friends."
                : "Share this code with your friends."}
            </small>
          </div>
        </div>
        <div className="lobby-columns">
          <section className="panel roster">
            <div className="panel-heading">
              <h2>
                <Users size={18} />
                The lineup <span>{game.players.length}/30</span>
              </h2>
              <span className="small-mono">{ready} READY</span>
            </div>
            <div className="player-list">
              {game.players.map((p, i) => (
                <div key={p.id} className="player-row">
                  <div className={`avatar avatar-${i % 4}`}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="player-name">
                    <strong>
                      {p.name} {p.id === me.id && <small>YOU</small>}
                    </strong>
                    <span>
                      {p.id === game.host ? (
                        <>
                          <Crown size={11} />
                          Host
                        </>
                      ) : p.connected ? (
                        "In the lobby"
                      ) : (
                        "Reconnecting…"
                      )}
                    </span>
                  </div>
                  <span className={`ready-pill ${p.ready ? "is-ready" : ""}`}>
                    {p.ready ? (
                      <>
                        <Check size={13} />
                        Ready
                      </>
                    ) : (
                      "Not ready"
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="empty-slots">
              <span>+</span>There’s room for more. Send out the code.
            </div>
          </section>
          <aside className="lobby-aside">
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <Settings2 size={18} />
                  Game plan
                </h2>
                {host && (
                  <button
                    className="text-button small"
                    onClick={() => {
                      setSettings(shown);
                      setEditing(!editing);
                    }}
                  >
                    {editing ? "Cancel" : "Edit"}
                  </button>
                )}
              </div>
              {editing ? (
                <form
                  className="settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("settings", settings).then((ok) => {
                      if (ok) setEditing(false);
                    });
                  }}
                >
                  {game.presets && (
                    <div
                      className="preset-row"
                      role="group"
                      aria-label="Game size"
                    >
                      <button
                        type="button"
                        className={
                          settings.preset === "auto" ? "is-active" : ""
                        }
                        aria-pressed={settings.preset === "auto"}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            ...autoTier?.settings,
                            preset: "auto",
                          })
                        }
                      >
                        Auto
                        <small>{autoTier?.name ?? "by players"}</small>
                      </button>
                      {game.presets.map((p) => (
                        <button
                          type="button"
                          key={p.name}
                          className={
                            settings.preset !== "auto" &&
                            Object.entries(p.settings).every(
                              ([k, v]) => settings[k as NumericSetting] === v,
                            )
                              ? "is-active"
                              : ""
                          }
                          onClick={() =>
                            setSettings({
                              ...settings,
                              ...p.settings,
                              preset: "custom",
                            })
                          }
                        >
                          {p.name}
                          <small>
                            {p.min}–{p.max}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                  {game.presets && (
                    <p className="preset-note">
                      {settings.preset === "auto"
                        ? `Sized automatically for the final head count when you start (${players} now).`
                        : "Custom values. Pick Auto to size by player count again."}
                    </p>
                  )}
                  <RadiusPreview
                    center={game.center}
                    radius={settings.radius}
                    minRadius={settings.min_radius}
                  />
                  <p className="preview-caption">
                    Safe zone {Math.round(settings.radius * 2)} m across · about{" "}
                    {Math.max(1, Math.round((settings.radius * 2) / 1.4 / 60))}{" "}
                    min to walk edge to edge · closes to{" "}
                    {Math.round(settings.min_radius * 2)} m
                  </p>
                  {fields.map((f) => (
                    <label key={f.key}>
                      {f.label}
                      <div>
                        <input
                          type="number"
                          required
                          min={f.min}
                          max={f.max}
                          value={settings[f.key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [f.key]: Number(e.target.value),
                              preset: "custom",
                            })
                          }
                        />
                        <span>{f.unit}</span>
                      </div>
                    </label>
                  ))}
                  <button className="primary full" disabled={busy}>
                    Save settings
                  </button>
                </form>
              ) : (
                <div className="settings-summary">
                  {game.settings.preset === "auto" && autoTier && (
                    <div>
                      <span>Size</span>
                      <strong>
                        Auto · {autoTier.name} for {players}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>Head start</span>
                    <strong>
                      {shown.hide_seconds / 60 < 1
                        ? `${shown.hide_seconds} sec`
                        : `${shown.hide_seconds / 60} min`}
                    </strong>
                  </div>
                  <div>
                    <span>The hunt</span>
                    <strong>{shown.hunt_seconds / 60} min</strong>
                  </div>
                  <div>
                    <span>Location reveals</span>
                    <strong>
                      Every{" "}
                      {shown.reveal_seconds < 60
                        ? `${shown.reveal_seconds}s`
                        : `${shown.reveal_seconds / 60} min`}
                    </strong>
                  </div>
                  <div>
                    <span>Safe zone</span>
                    <strong>
                      {shown.radius}m → {shown.min_radius}m
                    </strong>
                  </div>
                  <div>
                    <span>Seekers</span>
                    <strong>
                      {Math.max(1, seekerCount)} randomly assigned
                    </strong>
                  </div>
                </div>
              )}
            </section>
            <div className="lobby-notice">
              <Shield size={21} />
              <div>
                <strong>Your location stays yours.</strong>
                <p>
                  Seekers only see brief snapshots during reveals. Keep this app
                  open during the game.
                </p>
              </div>
            </div>
            <div className="location-caption">
              <MapPin size={14} />
              {game.center.lat.toFixed(4)}, {game.center.lng.toFixed(4)} ·
              meeting point
            </div>
          </aside>
        </div>
        <div className="lobby-bottom">
          <div>
            <Radio size={22} />
            <span>
              <strong>
                {ready === game.players.length
                  ? "Everyone’s ready. Let’s do this."
                  : "Waiting for the crew to ready up."}
              </strong>
              <small>
                {game.id === "demo"
                  ? "Demo uses a 15-second head start and simulated GPS."
                  : "Roles are assigned when the host starts the game."}
              </small>
            </span>
          </div>
          {locationMessage && (
            <p className="inline-error" role="alert">
              {locationMessage}
            </p>
          )}
          <div className="lobby-buttons">
            <button
              className={me.ready ? "secondary" : "primary"}
              disabled={busy || checking}
              onClick={toggleReady}
            >
              {me.ready ? <Check size={17} /> : <Shield size={17} />}{" "}
              {me.ready
                ? "Ready!"
                : checking
                  ? "Checking location…"
                  : "I’m ready"}
            </button>
            {host && (
              <button
                className="primary"
                disabled={
                  busy ||
                  game.players.length < 2 ||
                  ready !== game.players.length
                }
                onClick={() => void act("start")}
              >
                Start the game
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
