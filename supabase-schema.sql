-- SetTempo Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
--
-- If re-running after a previous version, drop old tables first:
--   DROP TABLE IF EXISTS setlist_sets, setlists, shows, set_entries, sets, songs, artists CASCADE;
--
-- Composite primary key (user_id, id) prevents ID collisions between users
-- since Dexie auto-increment IDs start from 1 for every user.

-- ── Artists ──────────────────────────────────────────────────────────────────
create table if not exists artists (
  id          bigint not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table artists enable row level security;
create policy "Users own their artists"
  on artists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists artists_user_updated_idx on artists(user_id, updated_at);

-- ── Songs ─────────────────────────────────────────────────────────────────────
create table if not exists songs (
  id          bigint not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  artist_id   bigint not null,
  title       text not null,
  bpm         integer not null default 120,
  time_sig_n  integer not null default 4,
  time_sig_d  integer not null default 4,
  notes       text,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table songs enable row level security;
create policy "Users own their songs"
  on songs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists songs_user_updated_idx on songs(user_id, updated_at);

-- ── Sets ─────────────────────────────────────────────────────────────────────
create table if not exists sets (
  id          bigint not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  artist_id   bigint not null,
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table sets enable row level security;
create policy "Users own their sets"
  on sets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists sets_user_updated_idx on sets(user_id, updated_at);

-- ── Set Entries ───────────────────────────────────────────────────────────────
create table if not exists set_entries (
  id                    bigint not null,
  user_id               uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  set_id                bigint not null,
  song_id               bigint not null,
  position              integer not null default 0,
  bpm_override          integer,
  time_sig_n_override   integer,
  time_sig_d_override   integer,
  notes_override        text,
  created_at            bigint not null,
  updated_at            bigint not null,
  deleted_at            bigint
);
alter table set_entries enable row level security;
create policy "Users own their set entries"
  on set_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists set_entries_user_updated_idx on set_entries(user_id, updated_at);

-- ── Shows ─────────────────────────────────────────────────────────────────────
create table if not exists shows (
  id          bigint not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  artist_id   bigint not null,
  name        text not null,
  date        text,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table shows enable row level security;
create policy "Users own their shows"
  on shows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists shows_user_updated_idx on shows(user_id, updated_at);

-- ── Setlists ──────────────────────────────────────────────────────────────────
create table if not exists setlists (
  id          bigint not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  show_id     bigint not null,
  name        text not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table setlists enable row level security;
create policy "Users own their setlists"
  on setlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists setlists_user_updated_idx on setlists(user_id, updated_at);

-- ── Setlist Sets ──────────────────────────────────────────────────────────────
create table if not exists setlist_sets (
  id              bigint not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, id),
  setlist_id      bigint not null,
  set_id          bigint not null,
  position        integer not null default 0,
  is_local_copy   boolean not null default false,
  created_at      bigint not null,
  updated_at      bigint not null,
  deleted_at      bigint
);
alter table setlist_sets enable row level security;
create policy "Users own their setlist sets"
  on setlist_sets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists setlist_sets_user_updated_idx on setlist_sets(user_id, updated_at);
