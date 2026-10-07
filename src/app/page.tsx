"use client";
import { useGame } from "@/lib/use-game";
import Home, { Brand } from "@/components/home";
import Lobby from "@/components/lobby";
import Gameplay from "@/components/gameplay";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { Ticker } from "@/components/pixel";
export default function Page() {
  const state = useGame();
  const {
    game,
    room,
    error,
    setError,
    busy,
    enter,
    demo,
    act,
    leave,
    sessionLost,
    startFresh,
  } = state;
  return (
    <>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {sessionLost && (
            <button className="fresh-start" onClick={startFresh}>
              Start fresh
            </button>
          )}
          <button aria-label="Dismiss message" onClick={() => setError("")}>
            <X size={18} strokeWidth={3} />
          </button>
        </div>
      )}
      {!room ? (
        <Home enter={enter} demo={demo} busy={busy} />
      ) : !game ? (
        <main className="loading-screen">
          <div className="console">
            <div className="console-top">
              <span className="icon-button light" aria-hidden="true" />
              <Brand />
              <span className="icon-button light" aria-hidden="true" />
            </div>
            <div className="code-screen">
              <LoaderCircle className="spin" size={34} strokeWidth={3} />
              <h1>Connecting to the room</h1>
            </div>
            <Ticker>LOADING</Ticker>
          </div>
          <button className="secondary" onClick={() => void leave()}>
            Back to home
          </button>
        </main>
      ) : game.phase === "lobby" ? (
        <Lobby game={game} busy={busy} act={act} leave={leave} />
      ) : ["finished", "cancelled"].includes(game.phase) ? (
        <div className="results-screen">
          <div
            className={`console ${game.winner === "seekers" ? "seeker" : game.winner === "hiders" ? "hider" : ""}`}
          >
            <div className="console-top">
              <span className="icon-button light" aria-hidden="true" />
              <Brand />
              <span className="icon-button light" aria-hidden="true" />
            </div>
            <div className="code-screen">
              <span className="label">
                {game.id === "demo" ? "PRACTICE ROUND OVER" : "ROUND OVER"}
              </span>
              <h1>
                {game.phase === "cancelled" ? (
                  "Match cancelled."
                ) : (
                  <>
                    {(game.winner ?? "").replace(/^./, (c) => c.toUpperCase())}{" "}
                    take the win.
                  </>
                )}
              </h1>
              {game.phase !== "cancelled" && (
                <p className="result-line">
                  {game.players.length} players,{" "}
                  {
                    game.players.filter(
                      (p) => p.role === "hider" && p.status === "active",
                    ).length
                  }{" "}
                  hiders left at the end.
                </p>
              )}
            </div>
            <Ticker tone="good">ROUND OVER</Ticker>
          </div>
          <button className="primary big-action" onClick={() => void leave()}>
            Back to base
            <ArrowRight size={20} strokeWidth={3} />
          </button>
          <small className="privacy-end">Location sharing has stopped.</small>
        </div>
      ) : (
        <Gameplay {...state} game={game} />
      )}
    </>
  );
}
