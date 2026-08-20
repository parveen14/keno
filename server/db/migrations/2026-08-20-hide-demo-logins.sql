-- Hide specific demo accounts from the login page's "Quick demo login" picker
--
-- Run this manually against your PRODUCTION database (this repo's automated seed/reset flow
-- only touches local Docker Postgres, never a remote/managed database).
--
-- Note: hard-deleting these two users was not viable -- both have extensive historical demo
-- data (orders, return cases, audit log entries, etc.) referencing them as the creator/actor,
-- and Postgres correctly refuses the delete rather than silently orphaning that history. This
-- migration instead adds a `hide_from_demo_picker` flag: the accounts (and everything they've
-- ever done in the demo) stay fully intact, they just stop appearing in the quick-login list.
--
-- Safe to run more than once: the column add is a no-op if it already exists, and the UPDATE
-- just re-applies the same flag.
--
-- Usage:
--   psql "$DATABASE_URL" -f server/db/migrations/2026-08-20-hide-demo-logins.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_demo_picker boolean NOT NULL DEFAULT false;

UPDATE users SET hide_from_demo_picker = true
WHERE email IN ('venue.anchor@keno-demo.example', 'venue.fitzroy@keno-demo.example');
-- venue.anchor@keno-demo.example  -> "Nedine Mullan (Venue: The Landmark, Eastwood)" (was "Dana Reed")
-- venue.fitzroy@keno-demo.example -> "Zoe Marsh (Venue: Fitzroy Club)"

COMMIT;
