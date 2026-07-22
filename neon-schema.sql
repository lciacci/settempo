-- SetTempo — Neon schema (Data API + Neon Auth)
--
-- Run against the project's production branch:
--   npx -y neon psql -- -f neon-schema.sql
--
-- Ported from supabase-schema.sql. Three differences matter, and each one
-- fails silently rather than loudly if you carry the Supabase version over:
--
--   1. auth.uid() → auth.user_id(). Neon's accessor reads the JWT `sub`
--      claim and returns TEXT, so user_id is text here, not uuid. A uuid
--      column would compare against a text function and reject every row.
--
--   2. No foreign key to auth.users. That table is Supabase's. Neon Auth
--      keeps its own users and the Data API contract is simply "user_id
--      holds the sub claim", so there is nothing here to reference.
--
--   3. GRANTs to the `authenticated` role are required. Supabase grants
--      these implicitly; Neon does not. Without them RLS is irrelevant
--      because the role cannot reach the table at all.
--
-- IDs are client-generated UUIDs (crypto.randomUUID() in the browser), so
-- the composite primary key (user_id, id) cannot collide across a user's
-- devices the way Dexie's per-device auto-increment did. See ADR-0001.

-- ── Server timestamp trigger ──────────────────────────────────────────────
-- The client strips updated_at from upsert payloads so this trigger is
-- authoritative — it is what makes the pull watermark immune to device clock
-- skew. Stored as bigint ms to match the Dexie representation.
create or replace function settempo_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end $$;

-- ── Tables ────────────────────────────────────────────────────────────────
-- user_id defaults to auth.user_id() as a safety net. The sync layer always
-- sends it explicitly, but a row that somehow arrives without one gets the
-- caller's identity rather than a null that RLS would then reject.

create table if not exists artists (
  id          text not null,
  user_id     text not null default (auth.user_id()),
  primary key (user_id, id),
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);

create table if not exists songs (
  id          text not null,
  user_id     text not null default (auth.user_id()),
  primary key (user_id, id),
  artist_id   text not null,
  title       text not null,
  bpm         integer,
  time_sig_n  integer,
  time_sig_d  integer,
  notes       text,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);

create table if not exists sets (
  id          text not null,
  user_id     text not null default (auth.user_id()),
  primary key (user_id, id),
  artist_id   text not null,
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);

create table if not exists set_entries (
  id                   text not null,
  user_id              text not null default (auth.user_id()),
  primary key (user_id, id),
  set_id               text not null,
  song_id              text not null,
  position             integer not null,
  bpm_override         integer,
  time_sig_n_override  integer,
  time_sig_d_override  integer,
  notes_override       text,
  created_at           bigint not null,
  updated_at           bigint not null,
  deleted_at           bigint
);

create table if not exists shows (
  id          text not null,
  user_id     text not null default (auth.user_id()),
  primary key (user_id, id),
  artist_id   text not null,
  name        text not null,
  date        text,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);

create table if not exists setlists (
  id          text not null,
  user_id     text not null default (auth.user_id()),
  primary key (user_id, id),
  show_id     text not null,
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);

create table if not exists setlist_sets (
  id             text not null,
  user_id        text not null default (auth.user_id()),
  primary key (user_id, id),
  setlist_id     text not null,
  set_id         text not null,
  position       integer not null,
  is_local_copy  boolean not null default false,
  created_at     bigint not null,
  updated_at     bigint not null,
  deleted_at     bigint
);

-- ── RLS, grants, triggers, indexes ────────────────────────────────────────
-- Applied in a loop rather than copy-pasted seven times. Every table carries
-- the identical policy, so repeating it by hand is seven chances to typo one
-- table into being world-readable.

do $$
declare t text;
begin
  foreach t in array array[
    'artists', 'songs', 'sets', 'set_entries', 'shows', 'setlists', 'setlist_sets'
  ] loop
    execute format('alter table %I enable row level security', t);

    -- Force RLS for table owners too. Without this, a query run as the owning
    -- role bypasses the policy entirely.
    execute format('alter table %I force row level security', t);

    execute format('drop policy if exists settempo_owner on %I', t);
    execute format($f$
      create policy settempo_owner on %I
        for all to authenticated
        using (auth.user_id() = user_id)
        with check (auth.user_id() = user_id)
    $f$, t);

    -- Without this the authenticated role cannot reach the table at all and
    -- every request fails on permissions before RLS is ever consulted.
    execute format(
      'grant select, insert, update, delete on %I to authenticated', t);

    execute format(
      'create index if not exists %I on %I (user_id, updated_at)',
      t || '_user_updated_idx', t);

    execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
    execute format($f$
      create trigger %I before insert or update on %I
        for each row execute function settempo_set_updated_at()
    $f$, t || '_set_updated_at', t);
  end loop;
end $$;

-- The Data API reads the schema through PostgREST; ask it to reload so new
-- tables are visible without waiting for its cache to expire.
notify pgrst, 'reload schema';
