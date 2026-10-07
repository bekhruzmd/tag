# TAG — Campus hide & seek

A mobile-first Next.js PWA for a real-world hide-and-seek game. Supabase Postgres owns role assignment, timers, safe zones, snapshots, tagging, eliminations, and results. No paid API, map key, custom domain, or app-store account is required.

## Run the interface

```sh
npm ci
npm run dev
```

Open http://localhost:3000. **Try the practice demo** works without any backend. It has five simulated players, a 15-second head start, a three-minute hunt, 30-second reveals, and 45-second zone stages. The demo is explicitly labeled and is NOT a multiplayer server. Its tag button simulates mutual confirmation.

## Enable real multiplayer

1. Create a **Supabase Free** project directly on supabase.com. Do not select Pro or add paid integrations. Keep the project password private.
2. In Authentication → Providers / Sign In, enable **Anonymous sign-ins**. No email or phone provider is needed. The app preserves an anonymous session across refreshes in the same browser. Clearing browser storage loses that identity.
3. Open the SQL editor and run `supabase/migrations/001_game.sql` **once** in a new project. This installs the private schema, RPCs, RLS-protected notification table, and Cron jobs. If prompted, enable the free `pg_cron` extension. Never publish private tables to Realtime.
4. Copy `.env.example` to `.env.local`. Set the project URL and the project's public **publishable / anon** key. Never put a service-role key, secret key, or database password in these variables.
5. Restart the dev server. Create a room, share the code, and join from other browsers.
6. Before a campus event, check Auth rate limits: anonymous signups default to 30/hour/IP. A shared campus NAT can exhaust that allowance. Raise it moderately for your expected group, and retain each player's existing session. This version has no CAPTCHA widget; enable one only after wiring its token into `authenticate()`.

## Deploy for $0

Create a personal **Vercel Hobby** project from this repository, using the Next.js preset. Add the two public environment variables from `.env.example` and deploy. Use the provided `*.vercel.app` URL; it provides HTTPS, required for phone geolocation. Create the Supabase project separately instead of purchasing it through a marketplace.

Hobby is for personal/noncommercial use. Stay on Free/Hobby; capacity exhaustion should interrupt the demo rather than require upgrading. Check current provider terms before launch. Free Supabase projects can pause after inactivity; resume and smoke-test before the event.

For local multi-phone testing, `http://<laptop-IP>:3000` does **not** generally qualify as a secure context for geolocation. Use the HTTPS Vercel deployment. Safari: Share → Add to Home Screen. Chrome: Install / Add to Home Screen.

## How to play

- Host creates a room centered on their meeting point, sets the rules, and shares the six-character code.
- Every player readies up. The host starts; the database randomly chooses seekers.
- Seekers physically wait through the hiding countdown. Browser software cannot enforce that physical rule.
- Keep the app visible. The app requests a screen wake lock when supported, but cannot guarantee background GPS.
- The zone contracts over the final 60 seconds of each stage (or the full interval for shorter stages). The new boundary is enforced at the deadline, with up to 10m of GPS tolerance. After a shrink, the new boundary remains enforceable on fresh location submissions.
- Reveal markers are immutable snapshots, visible to active seekers for five seconds by default. No hider live feed is sent to other players.
- A found hider taps **I've been found**, shows their short-lived code, and the seeker enters it. Both must have fresh GPS within the configured tag distance (default 20m). The hider then confirms.
- A hider without usable GPS receives bounded grace, then is eliminated. Leaving forfeits participation. All hiders out means seekers win; any surviving hider at expiry means hiders win.
- Elimination, finish, and leave stop sharing. Spectators see no private live locations.

## Commands

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The build uses Webpack to avoid Turbopack's IPC requirements in restricted environments. E2E tests launch a local dev server, so need permission to listen on localhost and an installed Playwright Chromium (`npx playwright install chromium`).

Database integration checks must run against an **isolated development Supabase database**, never a live game:

```sh
psql "$TAG_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/game.sql
```

The integration script runs in a transaction and rolls back its fixtures. It exercises permissions, role assignment, hiding/hunting transitions, snapshots and expiry, mutual tagging, zone elimination, and winning. The migration must already be applied.

## Implementation

- `src/components/`: home, lobby, game map/HUD, and the original SVG campus illustration.
- `src/lib/use-game.ts`: session, reconnect, GPS, wake lock, and command orchestration.
- `src/lib/supabase.ts`: small Auth/PostgREST/Realtime transport with native browser APIs. The official SDK is not required; realtime updates have a five-second state-poll fallback.
- `src/lib/demo.ts`: isolated practice simulation. Production commands cannot reach it.
- `supabase/migrations/001_game.sql`: trusted game engine and access boundary.
- `docs/architecture.md`: timing, data, security, and privacy details.
- `docs/field-test.md`: real-phone acceptance checklist.

## Validation status

See `docs/validation.md` for checks performed and environment limitations. A successful frontend build does not certify a deployed Supabase game. Complete the database tests and five-phone field test before calling this ready for an event.
