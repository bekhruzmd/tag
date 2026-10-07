"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Flag,
  LogOut,
  MapPin,
  Radio,
  ScanLine,
  Shield,
  Target,
  Users,
  X,
} from "lucide-react";
import { Ticker, ZoneRadar } from "./pixel";
import { Snapshot, Fix, countdown, clock } from "@/lib/types";
const GameMap = dynamic(() => import("./game-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading the field…</div>,
});
export default function Gameplay({
  game,
  fix,
  gps,
  now,
  synced,
  busy,
  challenge,
  act,
  leave,
}: {
  game: Snapshot;
  fix: Fix | null;
  gps: string;
  now: number;
  synced: boolean;
  busy: boolean;
  challenge: { code: string; expires: string } | null;
  act: (a: string, d?: Record<string, unknown>) => Promise<boolean>;
  leave: () => Promise<void>;
}) {
  const me = game.players.find((p) => p.id === game.me)!;
  const [showRoster, setShowRoster] = useState(false),
    [tagging, setTagging] = useState(false),
    [code, setCode] = useState(""),
    [announcement, setAnnouncement] = useState("");
  const alive = game.players.filter(
    (p) => p.role === "hider" && p.status === "active",
  ).length;
  const total = game.players.filter((p) => p.role === "hider").length;
  const reveal = countdown(game.next_reveal, now),
    zone = countdown(game.next_shrink, now);
  const seeking = me.role === "seeker",
    eliminated = me.status === "eliminated",
    hiding = game.phase === "hiding";
  const pending = game.tags.find(
    (t) => t.hider === me.id && Date.parse(t.expires) > now,
  );
  const sent = game.tags.find(
    (t) => t.seeker === me.id && Date.parse(t.expires) > now,
  );
  const visibleReveal = Boolean(
    game.reveal_expires && Date.parse(game.reveal_expires) > now,
  );
  const justRevealed = game.events.some(
    (e) =>
      e.kind === "reveal" &&
      now - Date.parse(e.at) >= 0 &&
      now - Date.parse(e.at) < game.settings.reveal_duration * 1000,
  );
  const zoneClosing =
    !hiding &&
    game.next_shrink &&
    zone <= Math.min(60, game.settings.shrink_seconds);
  useEffect(() => {
    setAnnouncement(
      game.phase === "hiding"
        ? `YOU ARE A ${me.role?.toUpperCase()}`
        : game.phase === "hunting"
          ? "THE HUNT BEGINS"
          : "",
    );
    const timer = setTimeout(() => setAnnouncement(""), 2600);
    return () => clearTimeout(timer);
  }, [game.phase, me.role]);
  const tickerText = eliminated
    ? "YOU ARE OUT. SPECTATING"
    : hiding
      ? seeking
        ? "HEAD START. HOLD AT THE MEETING POINT"
        : "HIDE. STAY INSIDE THE CIRCLE"
      : reveal <= 10
        ? `REVEAL IN ${reveal}`
        : visibleReveal || justRevealed
          ? "LOCATIONS REVEALED"
          : zoneClosing
            ? `ZONE CLOSING IN ${zone}S`
            : "THE HUNT IS ON";
  const gpsProblem =
    game.id !== "demo" &&
    !eliminated &&
    /denied|unusable|unavailable|low/.test(gps);
  const gpsAlarm = gpsProblem || Boolean(game.gps_deadline && !eliminated);
  useEffect(() => {
    // Players are looking at the world, not the screen: nudge them when location breaks.
    if (gpsAlarm) navigator.vibrate?.([220, 120, 220]);
  }, [gpsAlarm]);
  return (
    <div className="game-screen">
      <div className="console game-console">
        <div className="console-top">
          <button
            className="icon-button"
            aria-label="Leave game"
            onClick={() => {
              if (window.confirm("Leave this match and stop sharing location?"))
                void leave();
            }}
          >
            <LogOut size={22} strokeWidth={3} />
          </button>
          <div className="plaque timer-plaque" role="timer">
            <span className="label">{hiding ? "HEAD START" : "TIME LEFT"}</span>
            <strong>{clock(countdown(game.phase_ends, now))}</strong>
          </div>
          <span
            className={`icon-button role ${eliminated ? "out" : seeking ? "seeker" : "hider"}`}
            role="img"
            aria-label={eliminated ? "Spectator" : `Role: ${me.role}`}
          >
            {eliminated ? (
              <Eye size={24} strokeWidth={3} />
            ) : seeking ? (
              <Target size={24} strokeWidth={3} />
            ) : (
              <Shield size={24} strokeWidth={3} />
            )}
          </span>
        </div>
        <div className="map-bezel">
          <GameMap game={game} fix={fix} now={now} />
          <div className="radar-slot">
            <ZoneRadar
              center={game.center}
              radius={game.radius}
              nextRadius={game.next_radius}
              fix={fix}
              fallbackToCenter={game.id === "demo"}
              reveals={visibleReveal ? game.reveals : []}
            />
          </div>
          {!synced && (
            <div className="connection-banner" role="status">
              Connection lost. Actions are paused until it is back.
            </div>
          )}
          {announcement && (
            <div
              className="phase-announcement"
              aria-live="polite"
              key={announcement}
            >
              <h1>{announcement}</h1>
              <p>
                {game.phase === "hunting"
                  ? "Seekers can tag now. The circle keeps shrinking."
                  : seeking
                    ? "Hiders have a head start. Wait at the meeting point."
                    : "Get inside the circle and out of sight."}
              </p>
            </div>
          )}
          {showRoster && (
            <section className="game-roster panel">
              <div className="panel-heading">
                <h2>Players</h2>
                <button
                  className="icon-button small"
                  aria-label="Close player list"
                  onClick={() => setShowRoster(false)}
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>
              {game.players.map((p) => (
                <div className="compact-player" key={p.id}>
                  <span>
                    {p.name}
                    {p.id === me.id ? " (you)" : ""}
                  </span>
                  <small>
                    {p.status === "eliminated" ? "OUT" : p.role?.toUpperCase()}
                  </small>
                </div>
              ))}
            </section>
          )}
        </div>
        <Ticker>{tickerText}</Ticker>
      </div>
      <div className="game-bottom">
        <div className="game-status-row">
          <button onClick={() => setShowRoster(!showRoster)}>
            <Users size={18} strokeWidth={3} />
            {alive}/{total} hiders left
          </button>
          <span className="led-status">
            <i className={synced ? "led" : "led off"} />
            {game.id === "demo"
              ? "PRACTICE"
              : synced
                ? "CONNECTED"
                : "RECONNECTING"}
          </span>
        </div>
        {game.id === "demo" && (
          <div className="practice-label">
            PRACTICE MODE · SIMULATED GPS AND PLAYERS
          </div>
        )}
        {eliminated ? (
          <div className="game-message">
            <div>
              <strong>You’re out. The game goes on without you.</strong>
              <p>{me.reason}. Location sharing has stopped.</p>
            </div>
          </div>
        ) : hiding ? (
          <div className="game-message">
            <div>
              <strong>
                {seeking
                  ? "Give the hiders a head start."
                  : "Get out of sight."}
              </strong>
              <p>
                {seeking
                  ? "Stay at the meeting point until the hunt begins."
                  : "Your location is hidden. Stay inside the circle."}
              </p>
            </div>
          </div>
        ) : reveal <= 10 ? (
          <div className="game-message urgent">
            <div>
              <strong>Location reveal in {reveal}</strong>
              <p>
                {seeking
                  ? "Watch the map. They will have moved on."
                  : "Move before the next reveal."}
              </p>
            </div>
          </div>
        ) : visibleReveal || justRevealed ? (
          <div className="game-message urgent">
            <div>
              <strong>Locations revealed</strong>
              <p>
                {seeking
                  ? "Orange stars show where they were, not where they are."
                  : "Your position was shared. Move."}
              </p>
            </div>
          </div>
        ) : null}
        {zoneClosing && !eliminated && (
          <div className="zone-warning">
            <MapPin size={14} />
            <span>
              ZONE CLOSING · {zone}s to reach the {Math.round(game.next_radius)}
              m circle
            </span>
          </div>
        )}
        {gpsProblem && (
          <div className="gps-alert" role="alert">
            {gps}. Move to open sky, check location permission, and keep this
            screen on.
          </div>
        )}
        {game.gps_deadline && !eliminated && (
          <div className="gps-alert">
            Location check needed · {clock(countdown(game.gps_deadline, now))}{" "}
            to reconnect with usable GPS.
          </div>
        )}
        <div className="game-control-card">
          <div className="countdown-grid">
            <div>
              <span>
                <MapPin size={13} />
                SAFE ZONE
              </span>
              <strong>{game.next_shrink ? clock(zone) : "FINAL ZONE"}</strong>
              <small>
                {Math.round(game.radius)}m
                {game.next_shrink ? ` → ${Math.round(game.next_radius)}m` : ""}
              </small>
            </div>
            <div>
              <span>
                <Radio size={13} />
                NEXT REVEAL
              </span>
              <strong>{clock(reveal)}</strong>
              <small>{game.settings.reveal_duration}-second snapshot</small>
            </div>
          </div>
          {!hiding &&
            !eliminated &&
            (pending ? (
              <div className="tag-confirm">
                <strong>
                  {game.players.find((p) => p.id === pending.seeker)?.name}{" "}
                  found you.
                </strong>
                <p>Confirm only if you’ve met face to face.</p>
                <div>
                  <button
                    className="secondary"
                    disabled={busy || !synced}
                    onClick={() => void act("reject", { id: pending.id })}
                  >
                    Not a tag
                  </button>
                  <button
                    className="primary"
                    disabled={busy || !synced}
                    onClick={() => void act("confirm", { id: pending.id })}
                  >
                    <Check size={17} />
                    Confirm tag
                  </button>
                </div>
              </div>
            ) : seeking ? (
              <>
                {sent ? (
                  <p className="tag-wait">Waiting for the hider to confirm…</p>
                ) : tagging ? (
                  <form
                    className="tag-entry"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act("tag", { code }).then((ok) => {
                        if (ok) setTagging(false);
                      });
                    }}
                  >
                    <label>
                      Enter the code shown on the hider’s phone
                      <input
                        autoFocus
                        aria-label="Hider tag code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        minLength={6}
                        required
                        placeholder="A1B2C3"
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setTagging(false)}
                      >
                        Cancel
                      </button>
                      <button className="primary" disabled={busy || !synced}>
                        Request tag
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="primary full tag-button"
                    disabled={busy || !synced}
                    onClick={() =>
                      game.id === "demo" ? void act("tag") : setTagging(true)
                    }
                  >
                    <ScanLine size={21} />
                    {game.id === "demo"
                      ? "Practice a confirmed tag"
                      : "I found someone"}
                    <ArrowRight className="end-icon" size={19} />
                  </button>
                )}
              </>
            ) : (
              <>
                {challenge && Date.parse(challenge.expires) > now ? (
                  <div className="challenge-code">
                    <span>SHOW THIS TO YOUR SEEKER</span>
                    <strong>{challenge.code}</strong>
                    <small>
                      Expires in {countdown(challenge.expires, now)}s · Keep
                      both phones nearby
                    </small>
                  </div>
                ) : (
                  <button
                    className="secondary full tag-button"
                    disabled={busy || !synced}
                    onClick={() => void act("challenge")}
                  >
                    <Flag size={19} />
                    I’ve been found
                  </button>
                )}
              </>
            ))}
          <div className="gps-line">
            <span
              className={`status-dot ${fix && fix.accuracy <= 40 ? "" : "orange"}`}
            />
            {game.id === "demo"
              ? "Simulated location"
              : eliminated
                ? "Location sharing off"
                : gps}
            {fix && <span>±{Math.round(fix.accuracy)}m</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
