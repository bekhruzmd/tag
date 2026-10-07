"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Hash,
  MapPin,
  Shield,
  Radio,
  Users,
  ChevronLeft,
  LocateFixed,
  LoaderCircle,
  Check,
} from "lucide-react";
import CampusArt from "./campus-art";
import { configured } from "@/lib/supabase";
export function Brand() {
  return (
    <a href="/" className="brand" aria-label="TAG home">
      tag<span className="brand-dot">.</span>
      <span className="brand-cross">⌖</span>
    </a>
  );
}
export default function Home({
  enter,
  demo,
  busy,
}: {
  enter: (
    action: "create" | "join",
    data: Record<string, unknown>,
  ) => Promise<void>;
  demo: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<"home" | "create" | "join">("home"),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [center, setCenter] = useState<{ lat: number; lng: number } | null>(null),
    [gpsMessage, setGpsMessage] = useState(""),
    [locating, setLocating] = useState(false),
    [consent, setConsent] = useState(false);
  const locate = () => {
    setLocating(true);
    setGpsMessage("");
    if (!navigator.geolocation) {
      setGpsMessage("Your browser does not support location.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCenter({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setGpsMessage("Allow location access in your browser, then try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <div className="header-right">
          <span className="status-dot" /> OUTSIDE IS THE NEW ONLINE{" "}
          <span className="version-pill">BETA 01</span>
        </div>
      </header>
      <main className="landing-main">
        <section className="hero-copy">
          <div className="eyebrow">
            <span className="mini-cross">+</span> REAL-WORLD MULTIPLAYER
          </div>
          {mode === "home" ? (
            <>
              <h1>
                Your campus.
                <br />
                Your playground.
                <br />
                <span>Don’t get caught.</span>
              </h1>
              <p className="hero-description">
                Hide in plain sight. Chase your friends. Outrun the zone.
                <br className="desktop-break" /> The game is on your phone. The
                action is all around you.
              </p>
              <div className="entry-actions">
                <button
                  className="primary big-action"
                  onClick={() => setMode("create")}
                >
                  <Plus size={21} />
                  Create a game
                  <ArrowUpRight className="end-icon" size={21} />
                </button>
                <button
                  className="secondary big-action"
                  onClick={() => setMode("join")}
                >
                  <Hash size={21} />
                  Join with code
                  <ArrowRight className="end-icon" size={21} />
                </button>
              </div>
              <div className="hero-meta">
                <span>
                  <Users size={14} /> 2–30 players
                </span>
                <span>
                  <MapPin size={14} /> Play anywhere
                </span>
                <span>
                  <Shield size={14} /> No downloads
                </span>
              </div>
              <button className="text-button demo-link" onClick={demo}>
                Get a feel for it <ArrowRight size={15} />
                <span>TRY THE PRACTICE DEMO</span>
              </button>
            </>
          ) : (
            <div className="entry-form">
              <button
                className="text-button back-link"
                onClick={() => setMode("home")}
              >
                <ChevronLeft size={17} />
                Back to base
              </button>
              <h1>
                {mode === "create" ? (
                  <>
                    Round up
                    <br />
                    <span>your people.</span>
                  </>
                ) : (
                  <>
                    Got the code?
                    <br />
                    <span>You’re in.</span>
                  </>
                )}
              </h1>
              <p className="hero-description">
                {mode === "create"
                  ? "Set the meeting point. Invite your friends. Make a run for it."
                  : "Meet your group at the play area before you ready up."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void enter(mode, { name, code, ...center });
                }}
              >
                <label>
                  Your callsign
                  <input
                    autoComplete="nickname"
                    placeholder="What should we call you?"
                    maxLength={24}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {mode === "join" ? (
                  <label>
                    Room code
                    <input
                      className="code-input"
                      autoCapitalize="characters"
                      autoComplete="off"
                      placeholder="A1B2C3"
                      minLength={6}
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                    />
                  </label>
                ) : (
                  <>
                    <button
                      type="button"
                      className="location-picker"
                      onClick={locate}
                      disabled={locating}
                    >
                      {locating ? (
                        <LoaderCircle className="spin" size={20} />
                      ) : center ? (
                        <Check size={20} />
                      ) : (
                        <LocateFixed size={20} />
                      )}
                      <span>
                        {center
                          ? "Meeting point set"
                          : "Use my location as the meeting point"}
                        <small>
                          {center
                            ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
                            : "Choose a safe, open area on campus"}
                        </small>
                      </span>
                    </button>
                    {gpsMessage && <p className="inline-error">{gpsMessage}</p>}
                  </>
                )}
                <label className="consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I’ll keep the game visible and share location during the
                    match. Leaving stops sharing.
                  </span>
                </label>
                <button
                  className="primary full"
                  disabled={busy || !consent || (mode === "create" && !center)}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : mode === "create" ? (
                    <Plus size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}{" "}
                  {busy
                    ? "Connecting…"
                    : mode === "create"
                      ? "Create lobby"
                      : "Join lobby"}
                </button>
              </form>
              {!configured && (
                <div className="setup-note">
                  <Radio size={16} />
                  <span>
                    Multiplayer setup pending. Connect Supabase using the
                    README, or{" "}
                    <button onClick={demo}>try the practice demo</button>.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
        <section
          className="hero-map"
          aria-label="Illustration of a campus game"
        >
          <CampusArt />
          <div className="map-topline">
            <span>
              <i /> FIELD VIEW
            </span>
            <span>ILLUSTRATIVE MAP ↗</span>
          </div>
          <div className="map-coordinate">40°43′46.2″N &nbsp; 73°59′47.4″W</div>
          <div className="floating-callout">
            <div className="callout-icon">
              <Radio size={21} />
            </div>
            <div>
              <span>STAY ONE STEP AHEAD</span>
              <strong>They only get a glimpse.</strong>
              <p>Your location. Revealed for 5 seconds.</p>
            </div>
          </div>
          <div className="map-bottomline">
            <span>
              <i className="legend-green" />
              YOU
            </span>
            <span>
              <i className="legend-orange" />
              REVEAL SNAPSHOT
            </span>
            <span>⌖</span>
          </div>
        </section>
      </main>
      <section className="how-section">
        <div className="how-heading">
          <span className="eyebrow">LESS SCROLLING. MORE RUNNING.</span>
          <h2>One campus. Two sides. No standing still.</h2>
        </div>
        <div className="how-grid">
          <article>
            <span className="step-number">01 /</span>
            <Users size={23} />
            <h3>Get your crew together</h3>
            <p>
              Create a room, share the code, and meet outside. The game picks
              your side.
            </p>
          </article>
          <article>
            <span className="step-number">02 /</span>
            <Radio size={23} />
            <h3>Hide. Seek. Make your move.</h3>
            <p>
              Hiders get a head start. Seekers get brief location clues. Finding
              them is on you.
            </p>
          </article>
          <article>
            <span className="step-number">03 /</span>
            <MapPin size={23} />
            <h3>The circle gets smaller</h3>
            <p>
              Stay in the safe zone. Confirm a tag face to face. Last hider
              standing wins it.
            </p>
          </article>
        </div>
      </section>
      <footer className="site-footer">
        <span>MADE FOR THE REAL WORLD.</span>
        <span>
          No downloads. No paywalls. Just one more round.
          <ArrowUpRight size={15} />
        </span>
      </footer>
    </div>
  );
}
