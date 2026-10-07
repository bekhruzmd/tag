# Architecture

## Authority and access

Clients invoke `game_command(action, room, data)` and `get_game(room)`. Supabase authenticates the bearer token; the functions use `auth.uid()` and derive the player. They never trust a submitted role, winner, distance, or elimination state. Function permissions deny unauthenticated callers, and elevated functions have an empty search path with qualified table names.

Rooms are locked during commands and scheduled transitions. One additional per-user transaction advisory lock prevents concurrent create/join requests from allocating multiple active memberships. Natural guards prevent repeated start, repeated confirmations, and duplicate pending tags. A failed/retried non-idempotent operation can return an already-handled error; clients refetch the state. There is no generic command receipt table in this MVP.

Only `public.room_signals(room, version)` is published to Realtime. RLS limits that table to members. It contains no coordinates or private event payloads. All actual tables live in an unexposed `private` schema without client grants. `get_game` builds a narrow role-aware JSON response. The host gets no special access to hider locations.

Role assignments and the coordinate-free roster are visible to room members. Display names are rendered as text by React. Room membership is frozen after start; refreshes retain the authenticated identity. Hiders' locations appear only in an active seeker's authorized, unexpired snapshot response.

## Scheduling

A single Postgres Cron job runs each second. It locks and advances rooms, processing due deadlines in chronological order. Expiry wins an exact tie with a tag/zone/reveal, with earlier scheduled eliminations resolved first. Commands also advance the room before taking action. No clock is kept in a Vercel process, and the host's phone is not a server.

Clients derive visual countdowns from server timestamps and an estimated clock offset. They may animate the circle but do not decide outcomes. Notifications trigger refetches; periodic snapshots and foreground/reconnect sync repair missed events. A snapshot version prevents older state replacing newer state. Realtime is a latency optimization, not authority.

The current Cron implementation scans active/lobby rooms at this MVP scale. It is intentionally capped by short room retention, rather than built for thousands of rooms. Scheduled execution is best effort, not hard realtime. Expired reveal windows are skipped, never replayed late.

## Location and deadlines

`watchPosition` renders local position. Submissions are limited to meaningful movement (~8m), a minimum five-second interval, or a stationary heartbeat. Periodic fresh acquisitions cover devices whose watcher remains quiet while stationary. Uploads are not stored offline for later replay. Server validation rejects malformed, future, stale, and out-of-order measurements.

One row per player stores the current reading. Database receipt time and measurement time are kept separately. Phone-reported positions/timestamps are not cryptographically trustworthy. This is not cheat-proof against GPS spoofing or collusion.

All location submissions take the room lock and advance due events BEFORE replacing the previous point. This preserves the latest accepted pre-deadline sample without storing a trail. Reveals accept samples at most 20 seconds old and accuracy at most 40m. Their expiry is anchored to the scheduled reveal, not delivery time. Seekers receive a frozen batch; hiders and eliminated seekers do not.

Zone checks use Haversine distance. The visual circle uses a campus-scale geographic approximation. The enforcement boundary is the new radius plus reported uncertainty capped at 10m. Missing/poor GPS creates bounded grace; heartbeats and refreshing cannot reset it. After the first shrink, fresh outside positions also enforce the current zone. This prevents a player exploiting a GPS-grace window by temporarily coming inside and leaving immediately.

Tags require a hider-generated 60-second code, valid roles, a hunting match, two samples at most 15 seconds old and accuracy at most 40m, and distance within the configured threshold. Requests expire in 30 seconds. Confirmation repeats proximity/role checks. Codes are private and rate-limited; there is no nearby-player API. A confirmation dispute remains a social issue.

## Disconnects and leave

The match continues without the host. In a lobby, a host with no heartbeat for 60 seconds is replaced by the earliest connected player. After start no host decisions are required. Location loss has the configured grace period; forfeited/left hiders count as eliminated for victory purposes. If no seekers remain while hiders survive, the game cancels.

Leaving first turns off local participation/watchers, then sends the server command. If offline, a pending leave ID is saved and retried on reconnect or next load. Until then, the server applies GPS timeout. If the browser's storage is cleared, the anonymous identity is lost; rejoining cannot resurrect a player.

## Retention

No movement history is kept. Eliminating/leaving a player deletes their current position and reveal entry. Finishing purges all live/reveal locations. Expired reveal coordinates and tag codes are removed by cleanup (API expiry is enforced even before cleanup). Rooms expire within six hours; completed rooms within one hour. Orphaned anonymous users older than a day are cleaned up. Cron run logs older than an hour are pruned.

Coordinate-free game events are short lived with their room. No third-party analytics or location logging are installed. API responses are not cached by the service worker. The only service-worker cache is the offline fallback. OSM requests go directly from the browser and disclose the viewed map area to that tile service.

OSM tile attribution, cache headers, and normal browser referrers are retained. There is no tile prefetch/offline download. Public OSM tiles are best effort and can be blocked or unavailable; game state remains independent.

## MVP limits

- Foreground, online play; iOS/Android background tracking is not promised.
- Small games, 2–30 players. Shared free-tier capacity is not a service guarantee.
- No accounts, chat, push, Bluetooth, live spectator tracking, or permanent leaderboard.
- Short codes prove an in-person interaction socially; they do not prevent sharing a code remotely.
- Rate limits are basic. Invalid requests that raise an exception roll back their transaction counters. Do not advertise this as hardened against public abuse; deploy initially to a known campus group.
- The client uses a minimal native Supabase transport. Test token renewal and realtime reconnects on the deployed project before the event.
