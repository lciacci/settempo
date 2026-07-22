# SetTempo

A React PWA metronome and setlist manager built with an **Analog Precision** hardware rack aesthetic.

- Live app: https://houseofyeti.com/settempo/
- User guide: https://houseofyeti.com/settempo/guide.html

## Stack

- **React 19** + **Vite 7**
- **Tailwind CSS v4** (`@tailwindcss/vite`) — custom design tokens via `@theme` in `src/index.css`
- **Zustand** — app state (`useAppStore`)
- **Dexie.js** + **dexie-react-hooks** — IndexedDB for artists, songs, sets, setlists, shows; UUID primary keys
- **Neon** — Email-OTP auth (Neon Auth) and Postgres Data API for optional cross-device sync
- **@dnd-kit** — drag-and-drop in SongGridView and SetlistDetail
- **Web Audio API** — metronome scheduling via `useMetronome` hook
- **vite-plugin-pwa** — service worker, offline support, installable

## Key Architecture Notes

### Tailwind v4 CSS cascade
Custom classes in `src/index.css` are defined _after_ `@import "tailwindcss"`. This means any custom class that sets `position` (e.g. `.screw-head { position: relative }`) will override Tailwind utility classes of the same specificity. Use the **wrapper div pattern** for positioned elements: outer div owns `absolute`/`fixed`, inner `.screw-head` keeps `position: relative` for its `::after` pseudo-element.

### AudioContext / iOS
`AudioContext.resume()` is async. On iOS WKWebView (Chrome and Safari), the context startup is slower than on desktop. `useMetronome` uses a 0.3s start buffer when the context isn't yet running to prevent the first beats being scheduled in the past. iOS silent mode (ringer switch) also mutes Web Audio — not fixable in code.

### Beat accent
`useMetronome` captures `currentBeatForStore = beatRef.current` _before_ incrementing, then calls `setMetronome({ currentBeat: currentBeatForStore })`. This ensures beat 1 (index 0) is correctly reported as the accent beat.

### Song Starter vs regular play
`isStarterMode` local state in `Metronome.jsx` tracks which button initiated playback, keeping the starter trigger button and main play button visually independent even though they share the same `isPlaying` state from the store.

### Sync
Sync is local-first: Dexie is always the source of truth, and an authenticated user's data pushes/pulls against Neon's Postgres Data API via delta sync (`src/lib/sync.js`) keyed on `updatedAt`. `useSyncEngine` fires it automatically on sign-in, tab focus, reconnect, and a 60s idle interval, with a manual "Sync Now" button in the account panel as a fallback. Conflicts resolve last-write-wins using a server-stamped timestamp.

## Features

- **Metronome** — BPM, time signature, sound profile (beep/woodblock/cowbell), pitch, volume, mute, tap tempo
- **Gap Click** — configurable click/silent bar alternation for practice
- **Song Starter** — count-in mode that auto-stops after N bars
- **Library Archive** — artists → songs, sets, shows hierarchy
- **Song Library** — CRUD, search/filter, grid editor, CSV/XLSX import, quick-load to metronome
- **Set Library** — ordered song lists with per-entry BPM/time sig overrides
- **Setlists** — ordered sets within a show, drag-reorder, HTML/Print export
- **Shows** — date-stamped events with multiple setlists
- **Performance Mode** — full-screen display with BPM readout, beat pulse, song navigation, auto-start
- **Account & Sync** — optional Email-OTP sign-in (Neon Auth), automatic cross-device sync of the whole library
- **Backup/Restore** — JSON export/import (whole library or single artist), CSV/XLSX import templates

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
npm test          # run Vitest suite once
npm run test:watch
```

Sync requires Neon credentials at build/run time. Copy `.env.example` to `.env` and fill in `VITE_NEON_AUTH_URL` / `VITE_NEON_DATA_API_URL` (from `neon env pull`; schema in `neon-schema.sql`). Both are public — the Data API validates the session JWT and RLS scopes per user. Without them the app still runs fully offline — sign-in just won't work.

## Testing

Vitest covers the pure-logic layer: the Dexie helpers (`addRow`/`updateRow`/`softDelete`/`createId`) and the un-migratable-upgrade recovery, the sync engine's push/pull round trip plus account-scoping and empty-table recovery, backup import/export, the notify layer, and the camelCase ↔ snake_case column mappers (`src/db/__tests__`, `src/lib/__tests__`). IndexedDB is mocked with `fake-indexeddb`; the Neon client is stubbed in the sync tests.

Not covered, deliberately: components (Dexie + `@dnd-kit` interaction mocking has a poor cost/value ratio), the Web Audio scheduling in `useMetronome` (no `AudioContext` in jsdom), and visual/layout correctness (manual review across desktop Chrome/Safari, Android Chrome, iOS Safari/Chrome). `npm run build` doubles as a smoke test for import/type errors.
