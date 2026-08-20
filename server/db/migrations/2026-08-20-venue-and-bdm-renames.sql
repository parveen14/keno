-- Venue + venue manager + BDM renames
--
-- Run this manually against your PRODUCTION database (this repo's automated seed/reset flow
-- only touches local Docker Postgres, never a remote/managed database).
--
-- Safe to run more than once: every statement matches on the stable `code` (venues) or `email`
-- (users) column and just overwrites name/contact fields -- re-running just re-applies the same
-- values. Nothing else changes (jurisdiction, channel, address, order/rating history, etc. are
-- all untouched since venue_id itself never changes).
--
-- Judgment call: only 5 real venue names and 2 BDM names were given, but this demo has 18
-- venues and 2 BDMs. I renamed 5 existing venues (picked to spread across NSW/QLD/VIC, avoiding
-- the venues most central to previously-built demo walkthroughs) to the 5 given identities, and
-- renamed both existing BDM users to the 2 given names. If you had specific existing
-- venues/BDMs in mind for each name, tell me which and I'll redo the mapping.
--
-- Usage:
--   psql "$DATABASE_URL" -f server/db/migrations/2026-08-20-venue-and-bdm-renames.sql

BEGIN;

-- Venue + venue manager (contact_name) renames, matched by the stable venue code.
UPDATE venues SET name = 'Farmers Home Hotel, Wagga Wagga', contact_name = 'Andrew Dunstall' WHERE code = 'NSW-HOTEL-02';   -- was: Riverside Hotel / Sam Kelly
UPDATE venues SET name = 'Seven Seas Hotel, Carrington', contact_name = 'Bec Farrell' WHERE code = 'NSW-CLUB-01';          -- was: Central Sydney Club / Priya Nair
UPDATE venues SET name = 'Flagstone Tavern', contact_name = 'Cass Mawson' WHERE code = 'QLD-CLUB-01';                      -- was: Gold Coast Club / Nina Patel
UPDATE venues SET name = 'The Sun Hotel', contact_name = 'Darryn Haines' WHERE code = 'VIC-HOTEL-02';                      -- was: Geelong Hotel / Finn Doyle
UPDATE venues SET name = 'All Seasons International Motor Inn', contact_name = 'Mark O''Brien' WHERE code = 'VIC-HOTEL-01'; -- was: St Kilda Hotel / Ruby Lin

-- BDM renames, matched by the stable login email (keeps the existing "(BDM - <region>)"
-- suffix style already used throughout this app's user list).
UPDATE users SET name = 'Michael Osborn (BDM - NSW/QLD)' WHERE email = 'bdm.north@keno-demo.example';  -- was: Jordan Blake (BDM - NSW/QLD)
UPDATE users SET name = 'Murray Dawson (BDM - VIC)' WHERE email = 'bdm.south@keno-demo.example';        -- was: Casey Lane (BDM - VIC)

-- One VENUE-role demo login (venue.centralsydney@) is tied to NSW-CLUB-01, one of the venues
-- renamed above -- keep its display name in sync with the venue's new name/manager, matching
-- the "<manager name> (Venue: <venue name>)" convention already used for every other login.
UPDATE users SET name = 'Bec Farrell (Venue: Seven Seas Hotel, Carrington)' WHERE email = 'venue.centralsydney@keno-demo.example';

COMMIT;
