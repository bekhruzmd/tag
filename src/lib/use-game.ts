"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeRoom, command, getGame } from "./supabase";
import { Snapshot, Fix, distance } from "./types";
import { advanceDemo, demoAction, demoGame } from "./demo";
export function useGame() {
  const [game, setGame] = useState<Snapshot | null>(null),
    [room, setRoom] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [synced, setSynced] = useState(true),
    [fix, setFix] = useState<Fix | null>(null),
    [gps, setGps] = useState("Waiting for location"),
    [now, setNow] = useState(Date.now()),
    [challenge, setChallenge] = useState<{
      code: string;
      expires: string;
    } | null>(null);
  const offset = useRef(0),
    lastSync = useRef(Date.now()),
    lastSend = useRef<Fix | null>(null),
    leaving = useRef(false),
    sending = useRef(false),
    generation = useRef(0);
  const refresh = useCallback(async (id: string) => {
    const gen = generation.current;
    const started = Date.now();
    try {
      const data = (await getGame(id)) as Snapshot;
      if (gen !== generation.current || leaving.current) return;
      offset.current =
        Date.parse(data.server_time) - (started + Date.now()) / 2;
      lastSync.current = Date.now();
      setSynced(true);
      setGame((old) =>
        !old || old.id !== data.id || data.version >= old.version ? data : old,
      );
    } catch (e) {
      if (gen !== generation.current) return;
      setSynced(false);
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const id = localStorage.getItem("tag-room");
    if (id) {
      setRoom(id);
      if (id === "demo") setGame(demoGame());
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + offset.current);
      if (room === "demo") setGame((g) => (g ? advanceDemo(g, Date.now()) : g));
      else if (room && Date.now() - lastSync.current > 15000) setSynced(false);
    }, 500);
    return () => clearInterval(timer);
  }, [room]);
  useEffect(() => {
    if (!room || room === "demo") return;
    generation.current++;
    leaving.current = false;
    void refresh(room);
    const unsubscribe = subscribeRoom(
      room,
      () => void refresh(room),
      (connected) => {
        if (!connected) setSynced(false);
      },
    );
    const poll = setInterval(() => void refresh(room), 5000);
    const heartbeat = () =>
      void command("heartbeat", room).catch(() => setSynced(false));
    heartbeat();
    const beat = setInterval(heartbeat, 15000);
    const visibility = () => {
      if (!document.hidden) {
        setNow(Date.now() + offset.current);
        void refresh(room);
        heartbeat();
      }
    };
    window.addEventListener("online", visibility);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      generation.current++;
      clearInterval(poll);
      clearInterval(beat);
      window.removeEventListener("online", visibility);
      document.removeEventListener("visibilitychange", visibility);
      unsubscribe();
    };
  }, [room, refresh]);
  const player = game?.players.find((p) => p.id === game.me);
  const active = Boolean(
    game &&
      ["hiding", "hunting"].includes(game.phase) &&
      player?.status === "active",
  );
  useEffect(() => {
    if (!active || !room || room === "demo") {
      lastSend.current = null;
      setFix(null);
      return;
    }
    if (!navigator.geolocation) {
      setGps("Geolocation is unavailable");
      return;
    }
    let stopped = false;
    const onPosition = (p: GeolocationPosition) => {
      if (stopped || leaving.current) return;
      const next = {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      };
      setFix(next);
      setGps(next.accuracy > 40 ? "GPS accuracy is low" : "Location active");
      const previous = lastSend.current;
      const elapsed = previous ? next.timestamp - previous.timestamp : Infinity;
      if (
        !sending.current &&
        (!previous ||
          elapsed >= 9000 ||
          (elapsed >= 5000 && distance(previous, next) >= 8))
      ) {
        sending.current = true;
        void command("location", room, {
          lat: next.lat,
          lng: next.lng,
          accuracy: next.accuracy,
          observed_at: new Date(next.timestamp + offset.current).toISOString(),
        })
          .then(() => {
            lastSend.current = next;
          })
          .catch((e) => setGps((e as Error).message))
          .finally(() => {
            sending.current = false;
          });
      }
    };
    const onError = (e: GeolocationPositionError) =>
      setGps(
        e.code === 1
          ? "Location permission denied — enable it in browser settings"
          : "Waiting for a usable GPS signal",
      );
    const options = {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 12000,
    };
    const watch = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      options,
    );
    let acquiring = false;
    const acquire = () => {
      if (stopped || leaving.current || document.hidden || acquiring) return;
      acquiring = true;
      navigator.geolocation.getCurrentPosition(
        (p) => {
          acquiring = false;
          onPosition(p);
        },
        (e) => {
          acquiring = false;
          onError(e);
        },
        { ...options, maximumAge: 0 },
      );
    };
    // watchPosition may remain quiet while stationary; request fresh samples too.
    const sample = setInterval(acquire, 10000);
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      clearInterval(sample);
      document.removeEventListener("visibilitychange", acquire);
    };
  }, [active, room]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const request = async () => {
      if (!document.hidden && "wakeLock" in navigator)
        try {
          const acquired = await navigator.wakeLock.request("screen");
          if (done) await acquired.release();
          else lock = acquired;
        } catch {
          /* Optional capability. */
        }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [active]);
  const enter = async (
    action: "create" | "join",
    data: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError("");
    try {
      const result = await command(action, null, data);
      if (result.error) throw new Error(result.error);
      leaving.current = false;
      localStorage.setItem("tag-room", result.room);
      setRoom(result.room);
      await refresh(result.room);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const act = async (
    action: string,
    data: Record<string, unknown> = {},
  ): Promise<boolean> => {
    if (!room) return false;
    setBusy(true);
    setError("");
    try {
      if (room === "demo") {
        setGame((g) => (g ? demoAction(g, action, data) : g));
        return true;
      }
      const result = await command(action, room, data);
      if (result.error) throw new Error(result.error);
      if (action === "challenge") setChallenge(result);
      await refresh(room);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    const id = room;
    leaving.current = true;
    generation.current++;
    setRoom(null);
    setGame(null);
    setChallenge(null);
    setFix(null);
    localStorage.removeItem("tag-room");
    if (id && id !== "demo")
      try {
        await command("leave", id);
      } catch {
        localStorage.setItem("tag-pending-leave", id);
        setError(
          "Location sharing stopped. Reconnect to finish leaving the room.",
        );
      }
  };
  useEffect(() => {
    const retry = () => {
      const id = localStorage.getItem("tag-pending-leave");
      if (id)
        void command("leave", id)
          .then(() => localStorage.removeItem("tag-pending-leave"))
          .catch(() => {});
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  const demo = () => {
    offset.current = 0;
    leaving.current = false;
    setError("");
    setRoom("demo");
    setGame(demoGame());
    localStorage.setItem("tag-room", "demo");
  };
  return {
    game,
    room,
    error,
    setError,
    busy,
    synced,
    fix,
    gps,
    now,
    challenge,
    enter,
    act,
    leave,
    demo,
    refresh: () => (room ? refresh(room) : Promise.resolve()),
  };
}
