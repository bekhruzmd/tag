# TAG MVP — work audit

Recorded: October 3, 2026.

## Current status

The repository contains a Next.js mobile web application, an isolated practice simulation, and a Supabase database migration implementing the authoritative multiplayer game engine.

**The frontend production build and six automated tests pass. Real multiplayer has not been connected or verified. No deployment or working localhost server was established in this session.** Browser appearance, database execution, and outdoor phone behavior remain unverified.

This is a record of work and observed checks, not a certification that the game is ready for a campus event.

## Architecture work

- Reviewed the requested gameplay loop, privacy requirements, and $0 constraint before implementation.
- Consulted official documentation for Supabase, Firebase, Vercel, MapLibre, OpenStreetMap tile usage, browser geolocation, and Next.js.
- Selected Next.js, React, TypeScript, Tailwind, MapLibre, browser Geolocation, and Supabase Free. Vercel Hobby is the intended personal/noncommercial hosting target.
- Selected Postgres functions and Supabase Cron as the authority for game decisions, independent of the host's phone or a persistent Vercel process.
- Identified foreground GPS, GPS uncertainty, free-service availability, shared campus signup limits, and tag proximity probing as important constraints.
- Proposed a hider-generated short-lived tag code followed by GPS checks and mutual confirmation.
- Presented the architecture and stopped before implementation. Implementation began after the user requested the MVP.

## Application implemented

| Area | Code delivered |
| --- | --- |
| Home | Mobile layout, original SVG campus illustration, create/join forms, callsign, consent, host meeting-point selection, practice entry |
| Lobby | Room code and copying, roster, readiness, host indicator, editable settings, start and leave controls |
| Gameplay | Map-first screen, role and match timer, surviving hider count, zone/reveal countdowns, phase announcements, spectator state |
| Map | MapLibre with OSM raster tiles and attribution, current-user marker, safe-zone and next-zone boundaries, temporary snapshot markers, recenter control |
| Tagging | Hider code display, seeker code entry, request state, confirm/reject controls |
| Results | Hider/seeker results, survivor count, cancellation screen, return-home action |
| Phone support | Manifest, icons, offline fallback, optional wake lock, responsive layouts, reduced-motion CSS |
| Reconnection | Persisted anonymous session and room ID, realtime notification subscription, five-second state polling, foreground resync, pending leave retry |
| Location | Active-game watcher, movement/time-based submissions, periodic fresh acquisition while stationary, accuracy/status messages, watcher shutdown on leave/end/elimination |

The animate skill informed short CSS transitions for state indication and reduced-motion handling. No animation library or paid visual asset service was required.

## Practice mode

`src/lib/demo.ts` implements an explicitly labeled local simulation that requires no Supabase account.

- Five participants: the user and four simulated players.
- The user is assigned seeker for the walkthrough; this is not the production random assignment path.
- Defaults: 15-second head start, three-minute hunt, 30-second reveals, and 45-second zone stages.
- Simulated locations and a button that simulates a confirmed tag.
- Both win outcomes, shrinking circles, and expiring reveal snapshots.

Practice mode does not prove multiplayer, server authorization, physical proximity, or real GPS behavior. It resets to its demo lobby on refresh.

## Backend code delivered

`supabase/migrations/001_game.sql` contains:

- Private tables for rooms, players, current locations, reveals, tags, challenges, events, and basic rate limits.
- A public `room_signals` table containing only room ID and version, with membership-based row-level security.
- Authenticated `game_command` and `get_game` RPC functions.
- Membership and host checks, transactional room locking, and per-user locking for create/join.
- Server-side role assignment, hiding/hunting transitions, configurable timers and settings.
- Haversine zone enforcement, capped boundary tolerance, and bounded GPS-loss grace.
- Frozen reveal points, authorized seeker-only reads, expiry checks, and cleanup.
- Short-lived tag codes, fresh-location/distance checks at request and confirmation, and elimination.
- Win/cancellation handling, lobby host transfer, room expiry, and retention cleanup.
- A one-second Cron tick and a cleanup job that also prunes Cron run logs.

Raw locations are excluded from the realtime publication. The authorized state response is designed to disclose hider coordinates only to active seekers during a legitimate reveal window. These protections are implemented in SQL but have **not yet been exercised against Supabase**.

## Implementation differences from the proposal

- The browser uses a small native Fetch/WebSocket Supabase transport instead of `@supabase/supabase-js`. The SDK was unavailable in the local package cache and registry access failed. Auth refresh and command behavior have mocked tests; the live realtime protocol still needs verification.
- Zone/reveal schedules are represented by room fields and current reveal rows, rather than separate historical stage/batch tables.
- Retry protection uses transactional state checks and uniqueness constraints rather than a generic command-receipt table. A repeated action can return an already-handled error.
- The Cron worker scans active/lobby rooms at the intended small-game scale; it is not the proposed indexed due-room scheduler for larger workloads.
- After a shrink, fresh outside positions can also trigger elimination under the current boundary, rather than enforcement happening only at the shrink instant.
- Production builds use Webpack because Turbopack's worker port binding was blocked in this environment.

## Verification actually performed

| Check | Observed result |
| --- | --- |
| Dependency installation | Completed using cached npm packages; lockfile generated |
| `npm run typecheck` | Passed |
| `npm test` | Six tests passed |
| `npm run build` | Optimized Next.js build passed with Webpack |
| Supabase SQL integration tests | Written, not executed |
| Browser E2E tests | Written, not executed |
| Visual browser inspection | Not completed; browser tool reported no available browsers |
| Phone GPS, installation, battery, and network tests | Not performed |
| 30-client load test | Not performed |
| Hosting deployment | Not performed |

The six passing tests cover geographic distance, circle geometry, nonnegative countdowns, the practice loop and snapshot expiry, the practice survival win, and mocked authentication/command/token-refresh behavior. They do not execute the SQL engine.

The transactional SQL test script covers permission boundaries, host authorization, roles, phase transitions, snapshot isolation/expiry, mutual tagging, zone elimination, and the survival win. The Playwright tests cover the practice flow, viewport overflow, and consent gating. Both suites still require execution in an appropriate environment.

## Environment blockers and localhost attempts

- Registry requests failed with `ENOTFOUND registry.npmjs.org`. Cached dependencies were used instead.
- PostgreSQL initialization failed because the sandbox denied shared-memory creation. No local database was successfully started.
- Starting Next.js failed with `listen EPERM: operation not permitted 0.0.0.0:3000`, including the follow-up attempt after the user requested a phone URL.
- Reading the Mac's Wi-Fi address with `ipconfig getifaddr en0` also failed in the sandbox.
- The browser tool reported that Chrome was unavailable, then returned an empty browser inventory.
- No actual LAN URL was discovered or verified. The address shown in the earlier instructions was an example, not a running endpoint.

The user was given instructions to run the app from their own Mac Terminal and open the printed Network address on a phone connected to the same Wi-Fi. `localhost` on a phone refers to the phone, not the Mac. The HTTP LAN address is suitable for previewing the practice interface; real phone geolocation generally requires HTTPS.

## Known limitations and review items

- Reliable background or locked-screen location tracking is not supported. Keep the game visible.
- GPS can be inaccurate or spoofed. Tag codes and mutual confirmation do not prevent collusion or refusal to confirm an honest tag.
- Once a legitimate reveal reaches a device, the app cannot prevent that device from recording it.
- OSM tiles are a best-effort external dependency; no offline map download is implemented.
- Anonymous identity recovery depends on retaining browser storage.
- Basic database rate limits are not comprehensive abuse protection. Invalid actions that raise an exception roll back their counter updates.
- The native auth/realtime transport needs live token-renewal and reconnect testing.
- Default anonymous signup limits can affect a group behind the same campus IP. No CAPTCHA widget is wired into this MVP.
- Free-tier limits and terms were researched, but no account onboarding or deployed cost behavior was tested.
- No credentials, paid accounts, paid domain, paid map API, or external deployment were added.

## Remaining steps to a playable campus MVP

1. Run the app outside the restricted sandbox and inspect desktop/mobile layouts and practice mode.
2. Create or connect a Supabase Free development project, enable anonymous sign-ins, and apply the migration.
3. Configure `.env.local` using the project URL and public publishable/anon key. Never use an administrative key in frontend variables.
4. Run the database integration script against that isolated project and fix any failures before inviting players.
5. Exercise live auth, realtime updates, expiry races, reconnects, tag retries, and seeker network-payload privacy.
6. Run the browser E2E suite.
7. Deploy the configured app to an eligible Vercel Hobby project for HTTPS phone testing.
8. Complete the five-phone outdoor loop and then the load/battery checks in `docs/field-test.md`.

## Key files

- [README.md](README.md): local setup, Supabase configuration, deployment, and commands.
- [Database migration](supabase/migrations/001_game.sql): authoritative engine and access controls.
- [Database tests](supabase/tests/game.sql): transactional integration checks.
- [Game orchestration](src/lib/use-game.ts): GPS, room state, reconnects, and leave handling.
- [Supabase transport](src/lib/supabase.ts): Auth, RPC requests, and realtime notifications.
- [Architecture notes](docs/architecture.md): mechanics, security, timing, and retention.
- [Validation notes](docs/validation.md): completed checks and unverified areas.
- [Field test](docs/field-test.md): real-phone acceptance checklist.

This audit adds documentation only. It does not change gameplay code, start services, or deploy anything.
