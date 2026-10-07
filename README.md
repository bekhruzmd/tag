# TAG

**Your campus. Your playground. Don’t get caught.**

A real-world multiplayer hide-and-seek game. Gather your friends, share a room code, and head outside. Hiders stay out of sight while seekers chase brief location clues—all inside a shrinking safe zone.

**[Play TAG →](https://usftag.vercel.app)**

## How it works

1. **Get your crew together.** Create a room, choose your settings, and share the six-character code. Games support 2–30 players.
2. **Pick your side.** Once everyone is ready, the game randomly assigns seekers and gives hiders a head start.
3. **Follow the clues.** Seekers see periodic location snapshots that disappear after five seconds by default.
4. **Stay in the zone.** The safe zone shrinks as the game progresses. Staying outside it can eliminate a hider.
5. **Confirm the catch.** A found hider shares a short-lived code. The seeker enters it, GPS checks proximity, and the hider confirms the tag.

Seekers win if every hider is eliminated. Hiders win if anyone survives until time runs out.

## Features

- Room codes and anonymous sign-in—no email or password required.
- Configurable head starts, hunt duration, reveals, zones, and tag distance.
- Interactive maps with your position, safe zones, and temporary reveal markers.
- Database-controlled roles, timers, eliminations, and results.
- Reconnection support and sessions that persist across browser refreshes.
- Installable PWA with an offline fallback and screen wake lock where supported.
- Practice mode with simulated players, available without a backend.

## Built with

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Maps | MapLibre GL and OpenStreetMap tiles |
| Backend | Supabase Auth, PostgreSQL, Realtime, and Cron |
| Hosting | Vercel |

The browser uses a small native Fetch/WebSocket transport for Supabase. No map API key or additional Supabase SDK installation is needed for the current implementation.

## Run locally

```sh
git clone https://github.com/bekhruzmd/tag.git
cd tag
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) and choose **Try the practice demo**. Practice mode simulates a five-player game locally; it does not connect to other players.

### Enable multiplayer

1. Create a Supabase project.
2. Under **Authentication → Sign In / Providers**, enable **Anonymous sign-ins**.
3. In the SQL Editor, run [`supabase/migrations/001_game.sql`](supabase/migrations/001_game.sql) **once in a new project**. This creates the game tables, access rules, functions, Realtime publication, and scheduled jobs. Enable `pg_cron` if prompted.
4. Create your local environment file:

   ```sh
   cp .env.example .env.local
   ```

5. Fill in the project URL and public publishable/anon key:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
   ```

   Keep these exact variable names, including `ANON_KEY` when using a publishable key. Never use a secret key, service-role key, or database password here. `.env.local` is excluded from Git.

6. Restart the dev server. Create a room in one browser and join from another browser or private window.

To check that the scheduled jobs are installed, run this in Supabase's SQL Editor:

```sql
select jobname, schedule, active
from cron.job;
```

Both `tag-tick` and `tag-cleanup` should be active. Check their run history for successful executions before hosting a game.

## Deploy

Import the GitHub repository into Vercel using the **Next.js** preset. Add the two environment variables above before deploying. Redeploy after changing their values.

Use the HTTPS deployment for phone testing. A local address such as `http://<laptop-IP>:3000` generally cannot use phone geolocation. To install the app, use **Add to Home Screen** in Safari or **Install / Add to Home Screen** in Chrome.

## Playing on phones

- **Keep the app visible and stay online.** Background and locked-screen GPS are not supported. The offline page does not enable offline gameplay.
- GPS accuracy affects tags and zone checks. Missing or poor location readings receive a limited grace period before elimination.
- Hiders' positions are shared with active seekers only as temporary reveal snapshots. Other players do not receive a continuous hider location feed.
- Leaving, elimination, and the end of a game stop location sharing. Current coordinates are removed on the server; no movement history is kept.
- Clearing browser storage loses your anonymous identity. Keep the same browser session during a game.

## Development checks

```sh
npm run typecheck
npm test
npm run build
```

Run the browser tests with Playwright:

```sh
npx playwright install chromium
npm run test:e2e
```

Run database integration tests against an **isolated development Supabase database** with the migration already applied:

```sh
psql "$TAG_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/game.sql
```

The SQL tests run in a transaction and roll back their fixtures. They cover permissions, roles, phase transitions, reveal expiry, tagging, zone elimination, and game results.

## Project structure

```text
src/app/                 Pages, layout, styles, and PWA manifest
src/components/          Home, lobby, map, and gameplay UI
src/lib/                 Game state, Supabase transport, and practice simulation
supabase/migrations/     Database game engine and access controls
supabase/tests/          Database integration tests
tests/                   Unit and browser tests
public/                  Icons, service worker, and offline page
docs/                    Architecture and testing notes
```

## Project status

TAG is an early campus-game MVP deployed at [usftag.vercel.app](https://usftag.vercel.app). Type checking, six unit tests, and the production build have passed. Database integration tests, browser E2E tests, and outdoor multiplayer acceptance still need verification; deployment alone does not validate the full game.

Before an event, complete the [five-phone acceptance test](docs/field-test.md), then test the expected player count. Before a broader public launch, wire CAPTCHA into anonymous sign-in, review signup limits for shared campus Wi-Fi, and strengthen the current basic rate limits. GPS spoofing and player collusion are outside this MVP's protections.

See the [architecture notes](docs/architecture.md) for game logic and privacy details, and the [earlier validation record](docs/validation.md) for the initial testing history.
