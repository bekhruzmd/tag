import { test } from "node:test";
import assert from "node:assert/strict";
test("transport retains identity, sends authenticated commands, refreshes tokens and surfaces denied actions", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  const original = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  let denyRefresh = false;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    if (String(input).includes("/auth/v1/"))
      return new Response(
        JSON.stringify(
          denyRefresh
            ? { message: "Refresh rejected" }
            : {
                access_token: "test-token",
                refresh_token: "refresh-1",
                expires_at: Date.now() / 1000 + 3600,
              },
        ),
        { status: denyRefresh ? 401 : 200 },
      );
    const body = JSON.parse(String(init?.body));
    if (body.p_action === "confirm")
      return new Response(
        JSON.stringify({ message: "Tag request expired or already handled." }),
        { status: 400 },
      );
    return new Response(JSON.stringify({ room: "room-1" }));
  };
  try {
    const api = await import("../src/lib/supabase");
    await Promise.all([api.authenticate(), api.authenticate()]);
    assert.equal(calls.length, 1, "concurrent auth is deduplicated");
    await api.command("ready", "room-1", { ready: true });
    assert.equal(
      new Headers(calls[1].init.headers).get("Authorization"),
      "Bearer test-token",
    );
    assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
      p_action: "ready",
      p_room: "room-1",
      p_data: { ready: true },
    });
    await assert.rejects(
      api.command("confirm", "room-1", { id: "expired" }),
      /Tag request expired/,
    );
    const saved = JSON.parse(values.get("tag-session")!);
    saved.expires_at = 1;
    values.set("tag-session", JSON.stringify(saved));
    await api.authenticate();
    assert.ok(calls.at(-1)?.url.includes("grant_type=refresh_token"));
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init.body)), {
      refresh_token: "refresh-1",
    });
    saved.expires_at = 1;
    values.set("tag-session", JSON.stringify(saved));
    denyRefresh = true;
    await assert.rejects(api.authenticate(), /Refresh rejected/);
    assert.ok(
      values.has("tag-session"),
      "failed refresh must not silently replace player identity",
    );
  } finally {
    globalThis.fetch = original;
  }
});
