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
  return (
    <div className="game-screen">
      <GameMap game={game} fix={fix} now={now} />
      <div className="game-vignette" />
      <header className="game-top">
        <div className="game-top-row">
          <span className="game-wordmark">tag.</span>
          <span className={`role-chip ${seeking ? "seeker" : ""}`}>
            {eliminated ? (
              <Eye size={14} />
            ) : seeking ? (
              <Target size={14} />
            ) : (
              <Shield size={14} />
            )}{" "}
            {eliminated ? "SPECTATOR" : me.role?.toUpperCase()}
          </span>
          <button
            className="icon-button"
            aria-label="Leave game"
            onClick={() => {
              if (window.confirm("Leave this match and stop sharing location?"))
                void leave();
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
        <div className="game-timer">
          <span>{hiding ? "HEAD START" : "TIME TO SURVIVE"}</span>
          <strong>{clock(countdown(game.phase_ends, now))}</strong>
        </div>
        <div className="game-status-row">
          <button onClick={() => setShowRoster(!showRoster)}>
            <Users size={15} />
            {alive}/{total} hiders
            <ChevronDown size={14} />
          </button>
          <span>
            <i className={synced ? "status-dot" : "status-dot orange"} />
            {game.id === "demo" ? "PRACTICE" : synced ? "LIVE" : "RECONNECTING"}
          </span>
        </div>
      </header>
      {!synced && (
        <div className="connection-banner">
          Connection interrupted. Actions are unavailable until synced.
        </div>
      )}
      {announcement && (
        <div
          className="phase-announcement"
          aria-live="polite"
          key={announcement}
        >
          <span>THIS IS YOUR MOMENT</span>
          <h1>{announcement}</h1>
          <p>
            {seeking
              ? "Eyes up. Let them hide. Then go find them."
              : "Find your spot. Keep your next move ready."}
          </p>
        </div>
      )}
      {showRoster && (
        <section className="game-roster panel">
          <div className="panel-heading">
            <h2>The field</h2>
            <button
              className="icon-button"
              aria-label="Close player list"
              onClick={() => setShowRoster(false)}
            >
              <X size={16} />
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
      <div className="game-bottom">
        {game.id === "demo" && (
          <div className="practice-label">
            PRACTICE MODE · SIMULATED GPS & PLAYERS
          </div>
        )}
        {eliminated ? (
          <div className="game-message">
            <Eye size={22} />
            <div>
              <strong>You’re out. The chase goes on.</strong>
              <p>{me.reason}. Location sharing has stopped.</p>
            </div>
          </div>
        ) : hiding ? (
          <div className="game-message">
            <Shield size={22} />
            <div>
              <strong>
                {seeking
                  ? "Give them a head start."
                  : "Make yourself hard to find."}
              </strong>
              <p>
                {seeking
                  ? "Stay at the meeting point until the hunt begins."
                  : "Your location is hidden. Stay within the circle."}
              </p>
            </div>
          </div>
        ) : reveal <= 10 ? (
          <div className="game-message urgent">
            <Radio size={23} />
            <div>
              <strong>LOCATION REVEAL IN {reveal}</strong>
              <p>
                {seeking
                  ? "Watch for a snapshot. They won’t stay there."
                  : "Make your next move count."}
              </p>
            </div>
          </div>
        ) : visibleReveal || justRevealed ? (
          <div className="game-message urgent">
            <ScanLine size={23} />
            <div>
              <strong>LOCATION REVEALED</strong>
              <p>
                {seeking
                  ? "Orange markers show where they were, not where they are."
                  : "Your position was shared. Time to make your next move."}
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
