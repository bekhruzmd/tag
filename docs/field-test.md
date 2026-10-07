# Five-phone acceptance test

Use a safe outdoor area, foreground Safari/Chrome, HTTPS, and an active Supabase project. Verify its Cron jobs are succeeding before gathering players.

1. One host creates a room. Four phones join, including multiple users on the same Wi-Fi.
2. Set test rules: 30s head start, 3min hunt, 30s reveals, 45s shrink, 150m starting radius / 40m final radius, 20m tags. Ready every player, then start.
3. Confirm exactly one seeker and four hiders. Refresh one phone; verify the same role/membership returns.
4. Inspect a seeker network response during hiding and ordinary hunting. No hider coordinates may appear. Attempts to query private tables must fail.
5. Walk with a hider. At reveal, verify a static orange snapshot that does not follow them and disappears at expiry. Refresh after expiry; it must not reappear.
6. Let a zone stage close. A clearly outside hider with good GPS must be eliminated by the server. Borderline readings receive capped tolerance; poor readings get bounded grace.
7. Physically find a hider. Show their code, request a tag, and confirm. Try double confirmation and concurrent requests: only one elimination.
8. Disable GPS on a hider. Heartbeats or browser refreshes must not prevent the grace-period forfeit. Restore GPS within grace and verify recovery.
9. Disconnect the host. The hunt must continue. Test lobby host transfer separately.
10. Test both wins: all hiders out before expiry and one survivor at expiry. Verify eliminated/finished players stop location uploads.
11. Leave while offline, then reconnect. Verify the pending leave completes and location sharing stays off.
12. Repeat with 30 browser clients to measure room locks, API latency, Cron delay, egress, and realtime delivery before promising a 30-person event.

Also verify installation, portrait/landscape, browser permission denial, map outage, reduced motion, and a 30–60 minute battery/thermal test. Keep the game visible; locked-screen GPS is intentionally unsupported.
