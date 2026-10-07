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
              Phone-based hide and seek. The safe circle keeps shrinking.
            </p>
            <div className="entry-actions">
              <button
                className="primary big-action"
                onClick={() => setMode("create")}
              >
                Create a game
              </button>
              <button
                className="primary blue big-action"
                onClick={() => setMode("join")}
              >
                Join with code
              </button>
            </div>
            <button className="text-button demo-link" onClick={demo}>
              <span className="u">Try practice mode</span>
              <ArrowRight size={16} strokeWidth={3} />
            </button>
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
                      {center ? "Meeting point set" : "Set meeting point here"}
                      {center && (
                        <small>
                          {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                        </small>
                      )}
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
                <span>Share my location during the game.</span>
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
        <h2>How to play</h2>
        <ul>
          <li>The host makes a room and shares the code.</li>
          <li>Hiders hide. Seekers wait, then hunt.</li>
          <li>Stay inside the circle. It keeps shrinking.</li>
          <li>Reveals show where hiders were, not where they are.</li>
          <li>A tag counts when the hider confirms the seeker’s code.</li>
        </ul>
      </section>
      <footer className="site-footer">
        <span>Location is shared only during a game.</span>
      </footer>
    </div>
  );
}
