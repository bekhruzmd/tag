// Small browser-only Supabase transport: Auth + PostgREST + Realtime's Phoenix protocol.
// No service-role key or database credential is ever needed in the browser.
export const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
};
let pending: Promise<Session> | null = null;
function stored(): Session | null {
  try {
    return JSON.parse(localStorage.getItem("tag-session") ?? "null");
  } catch {
    return null;
  }
}
export async function authenticate(): Promise<Session> {
  if (!configured)
    throw new Error(
      "Multiplayer needs a Supabase project. Follow README.md, or try the practice demo.",
    );
  const old = stored();
  if (old && old.expires_at > Date.now() / 1000 + 90) return old;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(
      `${url}/auth/v1/${old ? "token?grant_type=refresh_token" : "signup"}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(
          old ? { refresh_token: old.refresh_token } : { data: {} },
        ),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.msg ??
          data.message ??
          data.error_description ??
          "Could not sign in. Check anonymous Auth is enabled.",
      );
    const session = {
      ...data,
      expires_at: data.expires_at ?? Date.now() / 1000 + data.expires_in,
    };
    localStorage.setItem("tag-session", JSON.stringify(session));
    return session;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
async function rpc(name: string, body: Record<string, unknown>) {
  const session = await authenticate();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? "Could not reach the game server.");
  return data;
}
export function command(
  action: string,
  room: string | null,
  data: Record<string, unknown> = {},
) {
  return rpc("game_command", { p_action: action, p_room: room, p_data: data });
}
export function getGame(room: string) {
  return rpc("get_game", { p_room: room });
}
export function subscribeRoom(
  room: string,
  onChange: () => void,
  onStatus: (connected: boolean) => void,
) {
  let socket: WebSocket | null = null,
    stopped = false,
    ref = 0,
    attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined;
  const topic = `realtime:tag-${room}`;
  const send = (event: string, payload: unknown) => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(
        JSON.stringify({
          topic: event === "heartbeat" ? "phoenix" : topic,
          event,
          payload,
          ref: String(++ref),
        }),
      );
  };
  const connect = async () => {
    try {
      const session = await authenticate();
      if (stopped) return;
      socket = new WebSocket(
        `${url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`,
      );
      socket.onopen = () => {
        send("phx_join", {
          config: {
            broadcast: { self: false },
            presence: { key: "" },
            postgres_changes: [
              {
                event: "UPDATE",
                schema: "public",
                table: "room_signals",
                filter: `room=eq.${room}`,
              },
            ],
          },
          access_token: session.access_token,
        });
        heartbeat = setInterval(() => {
          send("heartbeat", {});
          void authenticate()
            .then((s) => send("access_token", { access_token: s.access_token }))
            .catch(() => onStatus(false));
        }, 25000);
      };
      socket.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          if (
            message.event === "phx_reply" &&
            message.payload.status === "ok" &&
            message.payload.response?.postgres_changes
          ) {
            attempt = 0;
            onStatus(true);
            onChange();
          }
          if (message.event === "postgres_changes") onChange();
          if (message.event === "system" && message.payload.status === "error")
            onStatus(false);
        } catch {
          /* Ignore unrelated protocol frames. */
        }
      };
      socket.onerror = () => onStatus(false);
      socket.onclose = () => {
        clearInterval(heartbeat);
        onStatus(false);
        if (!stopped)
          retry = setTimeout(
            () => void connect(),
            Math.min(1000 * 2 ** attempt++, 15000),
          );
      };
    } catch {
      onStatus(false);
      if (!stopped) retry = setTimeout(() => void connect(), 5000);
    }
  };
  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(heartbeat);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
