// Smoke-tests the real Supabase backend: anonymous auth, create/join/read/leave, access rules.
// Creates throwaway anonymous users and one short-lived room; both leave at the end.
// Run: npm run test:live  (reads .env.local)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
  process.exit(1);
}
const headers = (token) => ({
  apikey: key,
  "Content-Type": "application/json",
  ...(token && { Authorization: `Bearer ${token}` }),
});
const signup = async () => {
  const r = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data: {} }),
  });
  return r.json();
};
const rpc = async (token, name, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
};
const command = (token, action, room, data = {}) =>
  rpc(token, "game_command", { p_action: action, p_room: room, p_data: data });
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail);
};
const a = await signup(),
  b = await signup(),
  c = await signup();
check(
  "anonymous sign-in (is anonymous auth on and CAPTCHA off?)",
  a.access_token && b.access_token && c.access_token,
  a.msg ?? a.message ?? "",
);
if (failed) process.exit(1);
const created = await command(a.access_token, "create", null, {
  name: "SmokeA",
  lat: 40.7295,
  lng: -73.9965,
});
check("create room", created.data.room, JSON.stringify(created.data));
if (!created.data.room) process.exit(1);
const room = created.data.room;
const joined = await command(b.access_token, "join", null, {
  name: "SmokeB",
  code: created.data.code,
});
check(
  "join with a second identity",
  joined.data.room === room,
  JSON.stringify(joined.data),
);
const game = await rpc(b.access_token, "get_game", { p_room: room });
check(
  "snapshot lists both players",
  game.data.players?.length === 2 && game.data.phase === "lobby",
  JSON.stringify(game.data).slice(0, 200),
);
const bad = await command(c.access_token, "join", null, {
  name: "X",
  code: "ZZZZZZ",
});
check(
  "unknown room code is rejected",
  Boolean(bad.data.error),
  JSON.stringify(bad.data),
);
const outsider = await rpc(c.access_token, "get_game", { p_room: room });
check(
  "non-member cannot read the room",
  outsider.status !== 200,
  `HTTP ${outsider.status}`,
);
const anon = await rpc(null, "get_game", { p_room: room });
check(
  "unauthenticated caller is denied",
  anon.status === 401 || anon.status === 403,
  `HTTP ${anon.status}`,
);
const lb = await command(b.access_token, "leave", room),
  la = await command(a.access_token, "leave", room);
check(
  "both players leave",
  lb.status === 200 && la.status === 200,
  JSON.stringify([lb.data, la.data]),
);
console.log(
  failed ? `\n${failed} check(s) failed` : "\nBackend smoke test passed",
);
process.exit(failed ? 1 : 0);
