-- Venue + venue manager renames (round 2 -- 8 more venues)
--
-- Run this manually against your PRODUCTION database (this repo's automated seed/reset flow
-- only touches local Docker Postgres, never a remote/managed database).
--
-- Safe to run more than once: every statement matches on the stable `code` (venues) or `email`
-- (users) column and just overwrites name/contact fields -- re-running just re-applies the same
-- values. Nothing else changes (jurisdiction, channel, address, order/rating history, etc. are
-- all untouched since venue_id itself never changes).
--
-- Judgment call: 8 names were given for 13 remaining un-renamed venues (5 were already renamed
-- by the previous migration). I matched by the location named in each new venue name where one
-- was given (Eastwood/Dulwich Hill/Leumeah/Orange -> NSW; Bli Bli/Mackay -> QLD -- Bli Bli in
-- particular is literally on the Sunshine Coast, so that pairing is an exact geographic match)
-- and filled the two location-less names (Prince Consort Hotel, South Terrace Hotel) into the
-- remaining QLD slots. 5 venues are left un-renamed this round (Cairns Leagues Club and the 4
-- Victorian venues not touched by round 1) since no names were given for them.
--
-- Usage:
--   psql "$DATABASE_URL" -f server/db/migrations/2026-08-20-venue-and-bdm-renames-2.sql

BEGIN;

UPDATE venues SET name = 'The Landmark, Eastwood', contact_name = 'Nedine Mullan' WHERE code = 'NSW-HOTEL-01';        -- was: The Anchor Hotel / Dana Reed
UPDATE venues SET name = 'Gladstone Hotel, Dulwich Hill', contact_name = 'Nick Overall' WHERE code = 'NSW-CLUB-02';   -- was: Western Suburbs Club / Leo Adams
UPDATE venues SET name = 'Club Hotel, Leumeah', contact_name = 'Tegan Baker' WHERE code = 'NSW-BOWLS-01';             -- was: Manly Bowls Club / Grace Tan
UPDATE venues SET name = 'Robin Hood Hotel, Orange', contact_name = 'Tim Eather' WHERE code = 'NSW-BOWLS-02';         -- was: Newcastle Bowls Club / Ollie Hart
UPDATE venues SET name = 'Bli Bli Hotel', contact_name = 'Tony Kemp' WHERE code = 'QLD-HOTEL-01';                     -- was: Sunshine Coast Hotel / Mia Chen
UPDATE venues SET name = 'Shamrock Hotel - Mackay', contact_name = 'Troy Tomkins' WHERE code = 'QLD-HOTEL-02';        -- was: Brisbane City Hotel / Tom Baker
UPDATE venues SET name = 'The Prince Consort Hotel', contact_name = 'Nick Firth' WHERE code = 'QLD-BOWLS-01';         -- was: Toowoomba Bowls Club / Ella Wood
UPDATE venues SET name = 'South Terrace Hotel', contact_name = 'Rita Suleiman' WHERE code = 'QLD-BOWLS-02';           -- was: Townsville Bowls Club / Ken Ito

-- Two of these venues have existing VENUE-role demo logins -- keep their display names in sync,
-- matching the "<manager name> (Venue: <venue name>)" convention used for every other login.
UPDATE users SET name = 'Nedine Mullan (Venue: The Landmark, Eastwood)' WHERE email = 'venue.anchor@keno-demo.example';
UPDATE users SET name = 'Tony Kemp (Venue: Bli Bli Hotel)' WHERE email = 'venue.sunshinecoast@keno-demo.example';

COMMIT;
