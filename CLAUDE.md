# SetTempo — Claude Context

## What This Is
A React 19 + Vite 7 PWA metronome and setlist manager for musicians. Local-first (IndexedDB via Dexie), optional Supabase sync, Analog Precision aesthetic (dark rack-equipment UI with amber accents).

## Stack
- **React 19 / Vite 7** — no routing (custom nav stack in Zustand store)
- **Tailwind v4** — custom theme, brushed-metal rack panel components
- **Dexie.js v4** — IndexedDB ORM, version 2 schema with soft deletes + delta sync
- **Zustand** — global state (nav stack, metronome, performance mode)
- **Supabase** — magic link auth + Postgres backend for sync
- **@dnd-kit** — drag-and-drop for set entry reordering
- **xlsx** — lazy-loaded (dynamic import) for CSV/XLSX song import
- **vite-plugin-pwa** — service worker, offline support, installable

## Project Structure
```
src/
  App.jsx                  # Root: nav, header, tab routing, auth wiring
  db/db.js                 # Dexie schema (v1+v2), softDelete/softDeleteWhere helpers
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
    PerformanceMode.jsx    # Full-screen performance view
    Settings.jsx           # Backup/restore, performance config, templates
    AuthModal.jsx          # Magic link sign-in + Sync Now panel
  public/
    guide.html             # User guide (standalone HTML, served at /guide.html)
    icons/                 # PWA icons (generated from icon.svg)
```

## Data Model (Dexie v2)
All tables have `createdAt`, `updatedAt`, `deletedAt` (bigint ms timestamps).
Soft deletes only — never hard delete. Filters always use `.filter(r => !r.deletedAt)`.

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
- **Delta sync**: push/pull records where `updatedAt > lastSyncedAt`
- **lastSyncedAt**: stored in `localStorage` keyed by `settempo_lastSyncedAt_{userId}`
- **Conflict resolution**: last-write-wins by `updatedAt`
- **Supabase schema**: composite PK `(user_id, id)` to avoid ID collisions (Dexie auto-increment starts at 1 per user)
- **Column mapping**: camelCase (Dexie) ↔ snake_case (Supabase) via mappers in `sync.js`
- Sync is **manual** — triggered by "Sync Now" button in AuthModal

## Auth
- Magic link (passwordless) via Supabase `signInWithOtp`
- `useAuth` hook: `getSession()` + `onAuthStateChange` subscription
- Sensors icon in header → opens AuthModal; amber LED dot when signed in
- Power icon appears when signed in → signs out

## Key Conventions
- All writes include `updatedAt: Date.now()` — required for delta sync
- Use `softDelete(table, id)` and `softDeleteWhere(table, index, value)` from `db/db.js` — never `.delete()`
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

## Current State (as of late March 2026)
- [x] Metronome (tap tempo, gap click, song starter, sounds, pitch)
- [x] Song library (add, edit, grid view, import CSV/XLSX, load to metronome)
- [x] Sets, shows, setlists with drag-to-reorder
- [x] Performance mode (full-screen, auto-advance, wake lock)
- [x] PWA icons and installable
- [x] Dexie v2 migration (soft deletes, updatedAt, delta sync readiness)
- [x] Magic link auth UI
- [x] Delta sync engine (push/pull, last-write-wins)
- [x] User guide at `/guide.html`

## Roadmap / Next
- Auto-sync on sign-in or on app focus (currently manual only)
- Supabase Redirect URL must be configured per environment before auth works
- Audio feedback review (users have flagged audio issues — investigate Web Audio timing)
- Consider adding Vitest for critical sync and data logic (assessed as medium effort, high value)
