"use client";
import { useGame } from "@/lib/use-game";
import Home, { Brand } from "@/components/home";
import Lobby from "@/components/lobby";
import Gameplay from "@/components/gameplay";
import {
  ArrowRight,
  Flag,
  LoaderCircle,
  Shield,
  Trophy,
  X,
} from "lucide-react";
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
            <X size={18} />
          </button>
        </div>
      )}
      {!room ? (
        <Home enter={enter} demo={demo} busy={busy} />
      ) : !game ? (
        <main className="loading-screen">
          <Brand />
          <LoaderCircle className="spin" />
          <h1>Finding your crew…</h1>
          <button className="secondary" onClick={() => void leave()}>
            Back to home
          </button>
        </main>
      ) : game.phase === "lobby" ? (
        <Lobby game={game} busy={busy} act={act} leave={leave} />
      ) : ["finished", "cancelled"].includes(game.phase) ? (
        <div className="results-screen">
          <Brand />
          <div className="results-symbol">
            {game.phase === "cancelled" ? (
              <Flag size={48} />
            ) : (
              <Trophy size={52} />
            )}
          </div>
          <div className="eyebrow">
            {game.id === "demo" ? "PRACTICE COMPLETE" : "THAT’S A WRAP"}
          </div>
          <h1>
            {game.phase === "cancelled" ? (
              "Match cancelled."
            ) : (
              <>
                {game.winner}
                <br />
                <span>take the win.</span>
              </>
            )}
          </h1>
          <p>
            {game.phase === "cancelled"
              ? "There are no active seekers left. Gather your crew for a new round."
              : game.winner === "hiders"
                ? "Out of sight. Out of time. The hiders made it."
                : "Nowhere left to hide. The seekers found their finish."}
          </p>
          <div className="result-stats">
            <div>
              <strong>{game.players.length}</strong>
              <span>PLAYERS</span>
            </div>
            <div>
              <strong>
                {
                  game.players.filter(
                    (p) => p.role === "hider" && p.status === "active",
                  ).length
                }
              </strong>
              <span>HIDERS SURVIVED</span>
            </div>
          </div>
          <button className="primary" onClick={() => void leave()}>
            Back to base
            <ArrowRight size={18} />
          </button>
          <small className="privacy-end">
            <Shield size={14} />
            Location sharing has stopped.
          </small>
        </div>
      ) : (
        <Gameplay {...state} game={game} />
      )}
    </>
  );
}
