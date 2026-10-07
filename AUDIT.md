# TAG — Change and deployment audit

Updated: October 7, 2026.

## Current status

TAG is published at **https://usftag.vercel.app** from **https://github.com/bekhruzmd/tag**, on the `main` branch. The Vercel project is named `usftag` and uses the existing Hobby team.

The production deployment succeeded, and the live homepage was opened and its content verified in Chrome. The two public Supabase environment variables were configured for Production and Preview. This confirms deployment and frontend loading; it does not confirm a complete multiplayer game.

Type checking, all six unit tests, and the local production build passed during this session. Database integration, browser E2E, outdoor phone, and load tests have not been verified.

## Scope and starting point

The project already contained the Next.js application, practice simulation, Supabase game engine, tests, and documentation when this session began. The original implementation record is preserved in [the October 3 audit](docs/audit-2026-10-03.md). Its deployment and environment statements describe that earlier session, not the current state.

Existing implementation includes:

- Home, create/join flows, lobby, map, gameplay, tagging, and results UI.
- Phone geolocation, wake lock, PWA manifest, icons, service worker, and offline fallback.
- Anonymous session persistence, reconnect handling, pending leave retries, and polling fallback.
- A native Fetch/WebSocket Supabase transport.
- A local practice game with simulated players.
- SQL functions for roles, timers, safe zones, snapshots, tagging, elimination, results, and retention.
- Private game tables, a membership-protected Realtime notification table, and Cron jobs.
- Unit, browser E2E, and database integration test files.

No gameplay source code, database migration, or package dependency changes were made in the work recorded below.

## Changes completed

### 1. Production-readiness review

Reviewed `package.json`, README, architecture and validation notes, the field-test checklist, Supabase transport, environment template, and relevant parts of the SQL migration. Consulted the installed Next.js deployment guide and official Supabase/Vercel documentation.

Identified the remaining launch work: validate the real backend, run browser tests, test foreground phone GPS and reconnects, measure expected player capacity, and improve abuse protection before a broad public launch.

### 2. GitHub publication

Published the project to `bekhruzmd/tag` on `main` using GitHub's API. The destination repository was empty.

The initial project upload contained 39 files. The remote tree was checked to confirm that file count. The upload excluded `node_modules`, `.next`, local environment files, TypeScript build information, and test output. `.env.example` was included as the setup template.

Local `git init` was blocked by filesystem permissions, and direct Git access failed to resolve GitHub. GitHub API access worked. Consequently, the local project directory was not initialized as a Git checkout or connected to a remote during this session.

| Commit | Change |
| --- | --- |
| `26f5377eb2033352e7e73b2746e78b8a19e75d7b` | Initialize the repository with README |
| `feb6ab3a96e18b36f394eccdd4724d025abf3334` | Upload application, database engine, tests, and supporting files |
| `e8207e154de27e3f76159e2fbd247baaced75127` | Refresh the README with the live app and setup guide |

### 3. Local Supabase configuration

The user created `.env.local`. Checked variable presence without displaying values, then renamed `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match the existing application's lookup. The key value was preserved.

The required variables are:

```env
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public publishable or anon key>
```

`.env.local` remains excluded from Git. No key values or database credentials are included in this audit.

Provided instructions for anonymous sign-in, applying the migration once, checking Cron jobs, and testing room creation/joining. Observed the user's Supabase dashboard with `public.room_signals` present. This observation does not prove that the entire migration, anonymous sign-in, Cron execution, or all access controls are working. Those checks remain pending.

### 4. Vercel deployment

Imported `bekhruzmd/tag` through the signed-in Vercel dashboard using the Next.js preset and the existing Hobby team. Created the project as `usftag`.

Configured both public Supabase variables for Production and Preview, and confirmed that their values matched `.env.local`. Submitted the deployment and observed Vercel's successful completion screen.

- Initial deployed source: `feb6ab3a96e18b36f394eccdd4724d025abf3334`.
- Deployment ID: `dpl_HrGN1Sv6FWJjmi7q6qHFftiFTp3J`.
- Production URL: https://usftag.vercel.app.
- Dashboard: https://vercel.com/bekhruzmds-projects/usftag.

Opened the production URL and verified that the homepage displayed its heading, create/join controls, practice entry, and gameplay explanation. Did not create a multiplayer room, grant location access, or run a full game as part of this check.

Later documentation commits were pushed to the connected GitHub repository. Their resulting Vercel builds were not separately inspected.

### 5. README refresh

Rewrote `README.md` for the public GitHub repository:

- Added the live application link and a short project introduction.
- Explained the gameplay loop, features, and technology choices.
- Added clone/install/run instructions and the exact environment variable names.
- Documented Supabase setup, Cron inspection, and Vercel configuration.
- Explained foreground GPS, online play, anonymous identity, and location sharing.
- Organized test commands, project structure, and outstanding validation work.
- Linked the architecture, field-test, and historical validation documents.

Checked that relative README links resolve to existing files, then pushed the change to `main`.

A short GitHub repository description was drafted in chat. The repository's description setting was not changed.

### 6. Audit update

Created this canonical uppercase `AUDIT.md` and moved the original lowercase `audit.md` to `docs/audit-2026-10-03.md` to preserve the earlier record without conflicting current-status claims. Updated links in the archived document for its new location and added a historical-status note to `docs/validation.md`.

## Installation attempts that did not complete

| Request | Observed outcome |
| --- | --- |
| `npm install @supabase/supabase-js @supabase/ssr` | Stalled while awaiting network access; interrupted. Neither package was added to `package.json`. |
| `npx skills add supabase/agent-skills` | Failed with `ENOTFOUND registry.npmjs.org`. |
| Install the curated `vercel-deploy` skill | Located the skill through GitHub's API; the installer failed on network name resolution. |
| `npx plugins add vercel/vercel-plugin` | Failed with `ENOTFOUND registry.npmjs.org`. |
| Vercel integration discovery | Found and offered the integration; installation/connection was not confirmed. |

The app continues to use its existing native Supabase transport. No Supabase SDK migration, SSR authentication integration, or successful plugin installation should be inferred from these attempts.

## Verification results

| Check | Result and limits |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | All six tests passed |
| `npm run build` | Passed using `next build --webpack` |
| GitHub initial upload | Remote tree contained 39 files |
| README relative links | Verified locally |
| Supabase environment configuration | Both required variables set; Vercel values matched local values |
| Initial Vercel build/deployment | Successful |
| Live homepage | Opened and content verified in Chrome; no comprehensive visual or interaction audit |
| Supabase SQL integration tests | Not run in this session |
| Browser E2E suite | Not run in this session |
| Real multiplayer/auth/reconnect | Not verified |
| Cron execution and location access controls | Not verified against the live backend |
| iPhone/Android outdoor GPS and battery | Not tested |
| 30-client load | Not tested |

Unit tests cover distance calculations, circle geometry, countdown clamping, practice mode and win outcomes, and mocked authentication/token renewal/transport errors. They do not execute the SQL game engine.

## Remaining work

1. Verify anonymous sign-in, complete migration installation, and successful `tag-tick`/`tag-cleanup` runs.
2. Run [database integration tests](supabase/tests/game.sql) against an isolated development Supabase database and resolve failures.
3. Run the browser E2E suite and inspect mobile layouts and permission/error states.
4. Test real create/join/start flows, token renewal, Realtime reconnects, reveal expiry, tagging, and role-based location access.
5. Complete the [five-phone outdoor acceptance test](docs/field-test.md), including GPS loss, offline leave, host disconnect, and both win conditions.
6. Measure load, Cron delay, API latency, and battery behavior at the intended event size.
7. Before broader public use, implement CAPTCHA token handling and stronger rate limits; review anonymous signup limits for shared campus networks.

## Known limits

- Gameplay requires foreground, online use; background or locked-screen GPS is unsupported.
- GPS accuracy varies, and positions can be spoofed. Mutual confirmation does not prevent collusion.
- Anonymous identity depends on browser storage.
- Public map tiles and hosting/database availability are external dependencies.
- Failed SQL requests can roll back the current basic rate-limit counters.
- A delivered reveal snapshot cannot be prevented from being recorded by its recipient.

This is a change and verification record, not a completed security audit or a guarantee of event readiness.
