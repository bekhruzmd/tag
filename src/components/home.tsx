"use client";
import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Hash,
  Menu,
  Radio,
  ChevronLeft,
  LocateFixed,
  LoaderCircle,
  Check,
} from "lucide-react";
import CampusArt from "./campus-art";
import { Sprite, Ticker, ZoneRadar } from "./pixel";
import { CROSSHAIR } from "@/lib/pixel-art";
import { configured } from "@/lib/supabase";
// Only the landing page links home. Inside a room a full reload would just restore the
// same screen from localStorage, so the wordmark stays plain text there.
// Title plaque. Only the landing page links home; inside a room a reload would just
// restore the same screen from localStorage.
export function Brand({ link = false }: { link?: boolean }) {
  const mark = (
    <>
      <span>TAG</span>
      <Sprite rows={CROSSHAIR} px={3} palette={{ o: "#bfe6ff" }} />
    </>
  );
  return link ? (
    <a href="/" className="plaque" aria-label="TAG home">
      {mark}
    </a>
  ) : (
    <span className="plaque" role="img" aria-label="TAG">
      {mark}
    </span>
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
      <div className="console">
        <div className="console-top">
          <a
            href="#rules"
            className="icon-button"
            aria-label="How a round works"
          >
            <Menu size={24} strokeWidth={3} />
          </a>
          <Brand link />
          <span className="icon-button light" aria-hidden="true">
            <Radio size={24} strokeWidth={3} />
          </span>
        </div>
        <div className="map-bezel art-bezel" aria-hidden="true">
          <CampusArt />
          <div className="radar-slot">
            <ZoneRadar
              center={{ lat: 0, lng: 0 }}
              radius={100}
              nextRadius={62}
              fix={null}
              fallbackToCenter
            />
          </div>
        </div>
        <Ticker>GPS ON. SCREEN ON. GO OUTSIDE.</Ticker>
      </div>
      <main className="landing-main">
        {mode === "home" ? (
          <>
            <h1>Hide and seek on your campus.</h1>
            <p className="hero-description">
              One group hides and one group seeks. A safe circle on the map
              keeps shrinking, so nobody can stay put. You play outside, on your
              phone, with people you can actually see.
            </p>
            <div className="entry-actions">
              <button
                className="primary big-action"
                onClick={() => setMode("create")}
              >
                Create a game
              </button>
              <button
                className="primary big-action"
                onClick={() => setMode("join")}
              >
                Join with code
              </button>
            </div>
            <p className="hero-meta">
              2 to 30 players. Needs GPS. Nothing to install.
            </p>
            <button className="text-button demo-link" onClick={demo}>
              <span className="u">Try practice mode</span>
              <ArrowRight size={16} strokeWidth={3} />
            </button>
            <p className="hero-meta">Simulated players, no account needed.</p>
          </>
        ) : (
          <div className="entry-form">
            <button
              className="text-button back-link"
              onClick={() => setMode("home")}
            >
              <ChevronLeft size={18} strokeWidth={3} />
              Back to base
            </button>
            <h1>{mode === "create" ? "Start a room" : "Join a room"}</h1>
            <p className="hero-description">
              {mode === "create"
                ? "Pick the meeting point, then share the code with your group."
                : "Get the 6-character code from the host and meet them at the play area."}
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
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
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
                      <LoaderCircle
                        className="spin"
                        size={22}
                        strokeWidth={3}
                      />
                    ) : center ? (
                      <Check size={22} strokeWidth={3} />
                    ) : (
                      <LocateFixed size={22} strokeWidth={3} />
                    )}
                    <span>
                      {center
                        ? "Meeting point set"
                        : "Use my location as the meeting point"}
                      <small>
                        {center
                          ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
                          : "Pick a safe, open area"}
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
                  I’ll keep the game visible and share my location during the
                  match. Leaving stops sharing.
                </span>
              </label>
              <button
                className="primary full"
                disabled={busy || !consent || (mode === "create" && !center)}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={20} strokeWidth={3} />
                ) : mode === "create" ? (
                  <Plus size={20} strokeWidth={3} />
                ) : (
                  <ArrowRight size={20} strokeWidth={3} />
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
                <Radio size={18} strokeWidth={3} />
                <span>
                  Multiplayer setup pending. Connect Supabase using the README,
                  or <button onClick={demo}>try practice mode</button>.
                </span>
              </div>
            )}
          </div>
        )}
      </main>
      <section id="rules" className="rules">
        <h2>How a round works</h2>
        <ul>
          <li>
            The host creates a room and shares the code. Everyone meets at the
            spot the host picked.
          </li>
          <li>
            When the host starts, a few players are chosen as seekers and the
            rest hide. Hiders get a head start.
          </li>
          <li>
            At each reveal, seekers see where every hider was a few seconds ago.
            It is a snapshot, not a live feed.
          </li>
          <li>
            The safe circle shrinks on a timer, and a hider caught outside it is
            out.
          </li>
          <li>
            A tag only counts when the seeker types the code on the hider’s
            phone and the hider confirms. The round ends when no hiders are left
            or time runs out.
          </li>
        </ul>
      </section>
      <footer className="site-footer">
        <span>Location is shared only while a game is running.</span>
        <span>
          Map data from OpenStreetMap contributors, served by OpenFreeMap.
        </span>
      </footer>
    </div>
  );
}
