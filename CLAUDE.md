# SetTempo — Claude Context

## What This Is
A React 19 + Vite 7 PWA metronome and setlist manager for musicians. Local-first (IndexedDB via Dexie), optional Supabase sync, Analog Precision aesthetic (dark rack-equipment UI with amber accents).

## Stack
- **React 19 / Vite 7** — no routing (custom nav stack in Zustand store)
- **Tailwind v4** — custom theme, brushed-metal rack panel components
- **Dexie.js v4** — IndexedDB ORM, version 3 schema (UUID keys, soft deletes, delta sync)
- **Zustand** — global state (nav stack, metronome, performance mode)
- **Supabase** — magic link auth + Postgres backend for sync
- **@dnd-kit** — drag-and-drop for set entry reordering
- **xlsx** — lazy-loaded (dynamic import) for CSV/XLSX song import
- **vite-plugin-pwa** — service worker, offline support, installable

## Project Structure
```
src/
  App.jsx                  # Root: nav, header, tab routing, auth wiring
  db/db.js                 # Dexie schema (v1→v3), addRow/updateRow, softDelete helpers
  store/useAppStore.js     # Zustand: navStack, metronome, performance state
  hooks/
    useMetronome.js        # Web Audio metronome engine
    useWakeLock.js         # Screen wake lock for performance mode
    useAuth.js             # Supabase session state, signIn, signOut
    useSyncEngine.js       # Sync state wrapper (idle/syncing/done/error)
  lib/
    supabase.js            # Supabase client (reads VITE_SUPABASE_* env vars)
    sync.js                # push/pull delta sync logic, camelCase↔snake_case mappers
  components/
    Metronome.jsx          # Main metronome UI (tap tempo, time sig, gap click, starter)
    ArtistList.jsx         # Library archive — artist module cards
    SongLibrary.jsx        # Song list with search/filter, load-to-metronome
    SongGridView.jsx       # Spreadsheet-style song editor
    SongImport.jsx         # CSV/XLSX import with column mapping
    SetLibrary.jsx         # Set list (reusable ordered song groups)
    SetEditor.jsx          # Drag-to-reorder set entries, per-entry BPM override
    ShowList.jsx           # Show registry
    ShowDetail.jsx         # Show → setlists
    SetlistDetail.jsx      # Setlist → sets, drag-to-reorder
    SetlistPicker.jsx      # Modal: pick setlist to perform
    SetlistExport.jsx      # Print/HTML export (no heavy deps, uses window.print)
    SongPicker.jsx         # Modal: add song to a set
    OverrideModal.jsx      # Modal: per-entry BPM / time sig / notes override
    PerformanceMode.jsx    # Full-screen performance view
    Settings.jsx           # Backup/restore, performance config, templates
    AuthModal.jsx          # Magic link sign-in + Sync Now panel
  public/
    guide.html             # User guide (standalone HTML, served at /guide.html)
    icons/                 # PWA icons (generated from icon.svg)
```

## Data Model (Dexie v3)
Primary keys are **string UUIDs** (`crypto.randomUUID()` via `createId()`), not auto-increment
ints. Dexie no longer generates ids — every insert must go through `addRow(table, data)`.
**A pre-v3 database is dropped, not migrated.** An in-place upgrade is impossible: IndexedDB
forbids changing a store's primary key, so Dexie rejects the schema diff up front
(`UpgradeError: Not yet support for changing primary key`). The v3 `.upgrade()` callback that
was meant to remap int ids and rewrite FK columns could never run and has been removed.
`openDb()` catches that error, calls `db.delete()`, clears both sync watermarks, and reopens
empty — returning `{ recovered: true }` so the UI can say the local store was rebuilt rather
than present an empty library as normal. Rows come back only from the server on the next pull,
so **anything a device never pushed is gone.**

All tables have `createdAt`, `updatedAt`, `deletedAt` (bigint ms timestamps).
Soft deletes only locally — never hard delete. Filters always use `.filter(r => !r.deletedAt)`.

```
artists     id, name, userId, updatedAt
songs       id, artistId, title, bpm, timeSigN, timeSigD, notes, updatedAt
sets        id, artistId, name, updatedAt
setEntries  id, setId, songId, position, bpmOverride, timeSigNOverride, timeSigDOverride, notesOverride, updatedAt
shows       id, artistId, name, date, updatedAt
setlists    id, showId, name, updatedAt
setlistSets id, setlistId, setId, position, isLocalCopy, updatedAt
```

## Sync Architecture
- **Local-first**: Dexie is always the source of truth
- **Two watermarks per user**, both in `localStorage` — mixing them in one value let a device
  with a fast clock persistently skip rows another device wrote:
  - `settempo_lastPushedAt_{userId}` — **local** clock ms. Push filter: rows with
    `updatedAt > lastPushedAt`. Snapshotted *before* the push so writes during the push
    window land on the next pass instead of being dropped.
  - `settempo_lastSyncedAt_{userId}` — **server** clock ms, the max `updated_at` ever seen
    from the backend. Pull filter uses this, so clock skew can't skip or duplicate rows.
- **Server-stamped `updated_at`**: push strips the client's value; a Postgres trigger fills
  it from `clock_timestamp()`. The upsert's `.select()` returns the authoritative timestamp,
  written back into Dexie so the next push filter agrees with the server.
- **Conflict resolution**: last-write-wins by `updatedAt`
- **Deletes**: soft locally, but pull **hard-deletes** any row whose remote `deletedAt` is
  set — the UI sees it gone and tombstones don't accumulate on the client
- **Supabase schema**: composite PK `(user_id, id)`, kept for RLS scoping. UUID ids made it
  no longer load-bearing for collision avoidance
- **Column mapping**: camelCase (Dexie) ↔ snake_case (Postgres) via `mappers` in `sync.js`
- Sync is **automatic** — `useSyncEngine` syncs on sign-in, tab focus, reconnect, and a 60s interval; "Sync Now" in AuthModal forces an immediate pass

## Auth
- Magic link (passwordless) via Supabase `signInWithOtp`
- `useAuth` hook: `getSession()` + `onAuthStateChange` subscription
- Sensors icon in header → opens AuthModal; amber LED dot when signed in
- Power icon appears when signed in → signs out

## Key Conventions
- Use `addRow(table, data)` for every insert — it generates the UUID and stamps
  `createdAt`/`updatedAt`. Dexie will not assign an id for you.
- Use `updateRow(table, id, patch)` for updates — it stamps `updatedAt`. Any hand-written
  write must include `updatedAt: Date.now()`; delta sync misses rows without it.
- Use `softDelete(table, id)` and `softDeleteWhere(table, index, value)` from `db/db.js` — never `.delete()`
  (the one exception is `pull()` in `sync.js`, which hard-deletes remote tombstones)
- DnD reorder and shuffle operations also include `updatedAt: Date.now()`
- `null` (not `undefined`) used for unset nullable fields in pulled records

## Environment
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
`.env` is gitignored. `.env.example` committed as reference. Vite bakes these into the bundle at build time — must be present locally before `npm run build`.

## Deploy
Self-hosted via SFTP. Build with `npm run build`, upload `dist/` contents to web root. Nginx needs `try_files $uri $uri/ /index.html` for SPA routing.

## Supabase Setup
Schema in `supabase-schema.sql`. Composite PKs (`user_id, id`). RLS enabled on all tables. Redirect URLs must be set in Supabase Auth → URL Configuration (one per line).

`supabase-migration-uuid.sql` converts the bigint id columns to text/uuid for the Dexie v3
change. **It must run before any device syncs after upgrading**, or pushes fail on type
mismatch.

## Current State (as of July 2026)
- [x] Metronome (tap tempo, gap click, song starter, sounds, pitch)
- [x] Song library (add, edit, grid view, import CSV/XLSX, load to metronome)
- [x] Sets, shows, setlists with drag-to-reorder
- [x] Performance mode (full-screen, auto-advance, wake lock)
- [x] PWA icons and installable
- [x] Dexie v2 migration (soft deletes, updatedAt, delta sync readiness)
- [x] Dexie v3 migration (UUID primary keys, FK remap, watermark reset)
- [x] Magic link auth UI
- [x] Delta sync engine (push/pull, last-write-wins, dual watermarks, server-stamped updated_at)
- [x] User guide at `/guide.html`
- [x] Auto-sync (sign-in, tab focus, reconnect, 60s interval)
- [x] Vitest suites for Dexie helpers, sync push/pull, column mappers

## Roadmap / Next
- **Migrate the backend off Supabase to Neon (neon.com).** Planned for the next work
  session. Researched 2026-07-22 — Neon now covers all three jobs Supabase does here, so
  this is a swap, not a re-architecture:
  - **Data API** — PostgREST-compatible HTTP interface built into Neon's proxy, callable
    straight from the browser, validates JWTs and enforces RLS. Client is
    `@neondatabase/neon-js`, whose `createClient(...).from().select().eq()` surface matches
    `supabase-js` closely enough that `sync.js` should need little more than an import swap
    (verify `.upsert(rows, { onConflict })` is supported — it is the one call we lean on
    that is not a plain select). **Beta**; enabled per-branch for a single database.
  - **Neon Auth** — managed Better Auth, users/sessions in a `neon_auth` schema, magic-link
    and email-OTP plugins supported first-class. Replaces `signInWithOtp` in `useAuth`.
    Free to 60K MAU.
  - **RLS** — policies port over, but the JWT accessor changes: `auth.uid()` →
    `auth.user_id()` (reads the `sub` claim). Composite PK `(user_id, id)` stays valid.
  - Data moves by dump/restore; UUID ids (Dexie v3) make that clean.
  - Context: Neon was acquired by Databricks in May 2025.
- `supabase-migration-uuid.sql` must be applied to the live backend before any device syncs
  post-Dexie-v3 (status unconfirmed) — moot if the Neon migration lands first
- Supabase Redirect URL must be configured per environment before auth works
- Audio feedback review (users have flagged audio issues — investigate Web Audio timing)

---

# Tessera harness

SetTempo is a Tessera downstream project (adopted 2026-07-21). Profile `standard`, declared in
`.tessera/project.yml`. The framework lives at `../tessera`; framework-level fixes land there,
not here.

## Working conventions

How the project owner works. The most important section.

- **Push back when you see drift.** Don't perform agreement. If a decision seems wrong or an
  assumption seems loaded, surface it — as honest feedback, not a refusal.
- **"Batching" is a one-word signal.** It means you're bundling decisions into prose instead of
  surfacing them as numbered choices. Stop, list the decisions, ask before committing.
- **Surface decisions before committing them.** Multi-step or irreversible changes warrant a
  brief "here's what I'd do, OK to proceed?"
- **Also record each surfaced gate — a separate step, backstopped.**
  `python3 scripts/gate/emit.py --fired --kind <kind> --note "<what you proposed>"` (`--held` if
  you weighed surfacing one and decided against; `--kind` is a closed enum: `design | scope |
  sequencing | process | finding | doc | outward`). A Stop hook
  (`.claude/scripts/tessera-gate-scan.sh` → `scripts/gate/scan.py`) counts gate-shaped turns in
  the transcript, diffs them against the session's gate log, and exits 2 on a gap.
  **Its detector is a recall net, not an oracle — you are the precision filter.** When it fires,
  log the gates you genuinely surfaced and say plainly which detected turns were only clarifying
  questions. It stays quiet on a gap of 1, so keep logging as you go.
- **When you are blocked and cannot proceed, raise an escalation — don't just say so and stop.**
  `tessera-escalate raise --category <cat> --summary "<what's stuck>" --tried "<attempt — how it
  failed>" --option "<what to choose between>"` (if `tessera/bin` isn't on PATH, use
  `python3 scripts/tessera-escalate`). `--tried` is required — a packet with no attempts is a
  complaint, not an escalation.
- **Use numbered lists for decision points.** Binary A/B beats a dense paragraph.
- **Name biases you notice in your own reasoning** — confirmation, sunk-cost, excitement,
  familiarity, anchoring.
- **Brief acknowledgments.** "Done," "Confirmed," "Clean."
- **Flag confidence levels.** What you know vs. infer vs. guess.

## Decision records

Decisions that are expensive to reverse — data model, sync semantics, auth, backend choice —
get an ADR in `docs/adr/`. Not UI, not library picks, not anything a `git revert` undoes
cleanly. See `docs/adr/README.md` for the threshold and format.

The *Consequences* section is the point: it must state the migration path for anything
already deployed. ADR-0001 exists because that question went unasked once and cost the whole
local user base.

## Findings channel

Runtime friction with Tessera itself goes in `docs/FINDINGS.md` — one finding per
`## F-NNN — Title` with a `**Status:**` line. It surfaces in the framework's SessionStart via
`tessera-findings`. An empty channel is meaningfully different from a missing file; don't delete it.

## Hook lifecycle (Mnemos)

Hooks in `.claude/settings.json` invoke scripts in `.claude/scripts/`; mnemos hooks resolve from
`~/.claude/templates` (`hook_distro: global` — no local copies, zero drift).

- **SessionStart** — loads any prior checkpoint
- **PreCompact** — emergency checkpoint before compaction
- **PreToolUse** — post-compaction restore check; fatigue/intent check on Edit/Write
- **PostToolUse** — logs tool outcomes
- **Stop** — checkpoint, transcript ingest + haze scoring, gate scan

When you see `MNEMOS CHECKPOINT` in context, a hook injected it — announce briefly, resume from
it, don't re-derive.

**This repo has no `.venv`.** The mnemos hooks try `.venv/bin/mnemos` first, then fall back to
`command -v mnemos` — so here they depend on `~/.local/bin/mnemos` being a live symlink into the
framework's venv. If hooks go silent, that link is the first thing to check (`readlink $(command -v
mnemos)`); repair with `../tessera/install.sh`. This is F-001's failure shape: a broken link makes
every hook fail open into silence rather than erroring.

## Tessera commands

- **`npm test`** — the suite. Declared in `.tessera/config.yml` as `test:`; never guess it.
- **`python3 scripts/gate/emit.py`** — record a surfaced gate (stdlib-only, bare `python3` is fine).
- **`tessera-escalate`** — raise/resolve a blocking escalation.
- **`tessera-watch`** — evaluate observatory triggers.

## Don't (harness)

- Don't edit `.env` / `.env.*` (also denied in `.claude/settings.json`).
- Don't commit secrets.
- Don't delete `docs/FINDINGS.md` when it's empty — empty ≠ missing.
