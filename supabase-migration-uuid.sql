-- SetTempo migration: bigint IDs → UUID (text) IDs
--
-- Why: per-device Dexie auto-increment created colliding (user_id, id)
-- composite keys across the same user's devices. Phone's artist id=1
-- "Beatles" overwrote laptop's artist id=1 "Pink Floyd" on push.
-- UUIDs make IDs globally unique.
--
-- WARNING: this DROPS all existing tables. Any rows currently in Supabase
-- will be lost. Local IndexedDB on each device still has its own copy,
-- and the Dexie v3 upgrade will re-push that data under new UUIDs on the
-- next sync. Run this BEFORE rolling out the new client to all devices,
-- otherwise old clients will try to push bigint ids into text columns
-- (or vice versa) and error out.
--
-- Sequence:
--   1. Make sure each device that has data has opened the app at least
--      once so it has a local copy of everything you care about.
--   2. Run this SQL in the Supabase SQL Editor.
--   3. Ship the new client. Each device's first sync will re-upload
--      its IndexedDB under new UUIDs.
--   4. Open the app on each device in turn so its push completes before
--      the next device pulls.

drop table if exists setlist_sets cascade;
drop table if exists setlists    cascade;
drop table if exists shows       cascade;
drop table if exists set_entries cascade;
drop table if exists sets        cascade;
drop table if exists songs       cascade;
drop table if exists artists     cascade;

-- Now run supabase-schema.sql to recreate the tables with text ids.
