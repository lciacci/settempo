# SetTempo — Current State Spec

**Version:** 1.0 (built)
**Type:** Progressive Web App (PWA)
**Platform:** Desktop + Mobile (offline-capable)
**Repo:** github.com/lciacci/Claude — branch `master`, path `projects/SetTempo/`
**Dev server:** `cd projects/SetTempo && npm run dev` → http://localhost:5173

---

## What Is Built

All four phases of the original spec are complete. The app is feature-complete v1.

### Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + Vite 7 |
| Styling | Tailwind CSS v4 (@tailwindcss/vite) |
| State | Zustand |
| Local DB | IndexedDB via Dexie.js + dexie-react-hooks |
| Audio | Web Audio API (no dependencies) |
| Offline/PWA | vite-plugin-pwa + Workbox |
| Wake Lock | Screen Wake Lock API |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Spreadsheet | SheetJS (xlsx) |
| PDF/Print | Browser print API (no jsPDF) |

---

## File Structure

```
src/
├── App.jsx                        # Root — nav stack, tab bar, routing
├── index.css                      # @import "tailwindcss"
├── main.jsx                       # React entry point
│
├── db/
│   └── db.js                      # Dexie schema (version 1)
│
├── store/
│   └── useAppStore.js             # Zustand store — nav, metronome, performance
│
├── hooks/
│   ├── useMetronome.js            # Web Audio scheduler, Song Starter, Gap Click
│   └── useWakeLock.js             # Screen Wake Lock API
│
└── components/
    ├── ArtistList.jsx             # Artist CRUD, entry point
    ├── SongLibrary.jsx            # Song CRUD, search/filter, usage counts,
    │                              #   toggles to SongGridView and SongImport
    ├── SongGridView.jsx           # Inline spreadsheet table, dnd reorder
    ├── SongImport.jsx             # CSV/XLSX import — map, preview, validate
    ├── SongPicker.jsx             # Modal: pick a song from library
    ├── SetLibrary.jsx             # Set CRUD with entry count + usage indicators
    ├── SetEditor.jsx              # Edit songs in a set, dnd, per-entry overrides
    ├── OverrideModal.jsx          # "Apply to entry only or update globally?"
    ├── ShowList.jsx               # Show CRUD
    ├── ShowDetail.jsx             # Setlist CRUD within a show
    ├── SetlistDetail.jsx          # Sets within a setlist, dnd, export buttons
    ├── SetlistPicker.jsx          # Modal: pick setlist to perform
    ├── SetlistExport.jsx          # exportSetlistPrint(), exportSetlistHTML()
    ├── Metronome.jsx              # Full metronome UI + Song Starter + Gap Click
    ├── PerformanceMode.jsx        # Fullscreen stage view
    └── Settings.jsx               # JSON backup/restore, template download
```

---

## Data Model (IndexedDB via Dexie)

```js
db.version(1).stores({
  artists:     '++id, name',
  songs:       '++id, artistId, title',
  sets:        '++id, artistId, name',
  setEntries:  '++id, setId, songId, position',
  shows:       '++id, artistId, name, date',
  setlists:    '++id, showId, name',
  setlistSets: '++id, setlistId, setId, position',
})
```

**Song fields:** id, artistId, title, bpm (1–300), timeSigN, timeSigD, notes, createdAt, updatedAt

**SetEntry fields:** id, setId, songId, position, bpmOverride (null = use song), timeSigNOverride, timeSigDOverride, notesOverride

**SetlistSet fields:** id, setlistId, setId, position, isLocalCopy (bool)

### Sharing & Override Rules (implemented)
- A Song lives in the artist's Song Library. SetEntries reference Songs by ID.
- SetEntry overrides (BPM, timeSig, notes) are stored on the entry. When editing, `OverrideModal` asks: "Apply to this entry only, or update the song globally?"
- Sets are referenced by Setlists via SetlistSets. `isLocalCopy: false` = shared reference. `isLocalCopy: true` = the set was explicitly copied to diverge (flag is stored but UI currently treats both the same — see Known Limitations).
- If a shared Set's song list changes, all Setlists using it reflect the change automatically (live Dexie queries).

---

## Global State (Zustand — `useAppStore`)

```js
{
  // Navigation
  currentArtistId: null,
  navStack: [],          // [{ view: 'set-editor'|'show-detail'|'setlist-detail', params: {} }]

  // Metronome
  metronome: {
    bpm: 120,
    isPlaying: false,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    currentBeat: 0,
    currentBar: 0,
    volume: 0.8,
    pitch: 0,            // semitones, -12 to +12
    sound: 'beep',       // 'beep' | 'woodblock' | 'cowbell'
    muted: false,
    starterDone: false,  // flips true when Song Starter finishes
    gapClickEnabled: false,
    gapClickBars: 2,
    gapSilentBars: 2,
    gapPhaseIsClick: true,
  },

  // Performance Mode
  performance: {
    active: false,
    setlistId: null,
    songIndex: 0,
    autoStartMetronome: false,
    afterStarterFinish: 'stop',  // 'stop' | 'advance'
    starterBarCount: 2,
  },
}
```

---

## Metronome Engine (`useMetronome.js`)

Web Audio API lookahead scheduler. Reads live state from `useAppStore.getState()` inside the scheduler loop (avoids stale closures).

**API:**
```js
const { start, stop, toggle } = useMetronome()

// Normal start
start()

// Song Starter mode — plays N bars then stops and calls onDone
start({ starterBars: 4, onDone: () => {} })
```

**Song Starter:** `starterBarsRef` tracked in a ref. When `barRef.current >= starterBarsRef.current`, the scheduler calls `onDone?.()` and stops.

**Gap Click:** `gapPhaseIsClickRef` and `gapPhaseBarRef` tracked in refs. The scheduler mutes audio during silent phases.

**Known limitation:** Visual beat dots fire on the scheduled beat, not the sounded beat, so they appear very slightly ahead of audio (~100ms). This is imperceptible in practice.

---

## Navigation

`App.jsx` uses a stack (`navStack` in Zustand) for deep views:

```
Top-level tabs: Metronome | Library | Shows | Artists | Settings
  (Library and Shows only appear when an artist is selected)

Library sub-tabs: Songs | Sets

Deep views pushed onto navStack:
  set-editor    → SetEditor
  show-detail   → ShowDetail
  setlist-detail → SetlistDetail

Performance Mode: replaces entire App when performance.active === true
```

The orange **▶ Perform** button in the header opens `SetlistPicker`, then launches `PerformanceMode` fullscreen.

---

## Features

### Metronome
- BPM 1–300, ±1 / ±5 step buttons, numeric input
- Tap tempo: average of last 4–8 taps, resets after 3s inactivity
- Time signature: numerator 1–16, denominator 2/4/8/16, preset buttons (4/4, 3/4, 6/8, 7/8, 5/4, 12/8)
- Sounds: Beep (sine), Wood Block (triangle), Cowbell (dual square oscillators)
- Volume: 0–100%, pitch: ±12 semitones (both persist in Zustand, not localStorage yet)
- Mute toggle (visual-only mode)
- Beat 1 accent (distinct oscillator frequency)
- Visual beat dots + beat/bar counter

### Song Starter
- Bar count selector: 1 / 2 / 4 / 8 / 16 bars
- After-finish mode: "Stop & wait" or "Auto-advance" to next song
- Large trigger button separate from regular play/stop
- Live countdown shows bars remaining
- Available in both Metronome tab and Performance Mode

### Gap Click (Practice Mode)
- Configurable click bars and silent bars (1–32 each)
- Visual CLICK / SILENT phase indicator
- Only shown in Metronome tab, not in Performance Mode

### Performance Mode
- Fullscreen, dark background, Wake Lock active
- Large song title, BPM in orange, time signature, notes
- Set progress indicator (Song X of N)
- Prev / next song arrows
- Song Starter trigger + regular play/stop
- Auto-start metronome toggle (AUTO button)
- Tap song area to advance to next song

### Library Management
- **Artists:** create, list, select
- **Song Library:** create/edit/delete, search by title, filter by BPM min/max, usage count ("in N set entries"), load to metronome (▶)
- **Song Grid View:** inline spreadsheet table, drag-to-reorder, Tab/Enter navigation, "Save all" batch write
- **Song Import:** CSV/XLSX upload, auto header detection, manual column mapping, preview with per-row validation, Add or Replace modes
- **Set Library:** create/edit/delete, entry count + setlist usage count
- **Set Editor:** add songs from picker, drag-to-reorder, per-entry BPM/timeSig/notes overrides with override prompt
- **Shows:** create/delete with cascade
- **Setlists:** create/delete within a show
- **Setlist Detail:** add sets from library (by reference or local copy), drag-to-reorder sets

### Export
- **Setlist → Print/PDF:** opens browser print dialog with formatted setlist HTML
- **Setlist → HTML:** downloads standalone HTML file
- **JSON backup:** export current artist or all artists
- **JSON restore:** import with Merge or Replace-all mode, remaps IDs to prevent collisions
- **Import template:** download XLSX or CSV template

---

## Known Limitations & Things Not Yet Done

| Area | Gap |
|---|---|
| Preferences persistence | Volume, pitch, sound, starter bar count live in Zustand only — they reset on page reload. Should persist to localStorage. |
| Local copy of Set | `isLocalCopy` flag is stored in DB but the UI doesn't yet let you edit a local copy independently of the original set. Both reference the same set. |
| Song Starter per-song config | Spec says starter bar count should be saveable per song. Currently it's a single global preference in the performance store. |
| Grid view for Set Entries | Spec mentions grid view for Set Entries (not just Song Library). Not yet built. |
| Performance Mode setlist picker | Picker shows all setlists flat. No search or sorting. |
| Error handling | No toast/snackbar system. Errors surface as `alert()` or `console.error`. |
| App icons | PWA manifest references `icons/icon-192.png` and `icons/icon-512.png` which don't exist. Install prompt will lack icons. |
| No tests | Zero automated tests. |

---

## How to Continue Development

**To start a new session with Claude Code:**

1. Open terminal, `cd /Users/lorenzociacci/claude/projects/SetTempo`
2. Run `npm run dev`
3. Open a new Claude Code session in this directory
4. Paste this file into Claude and describe what you want to change or add

**Common tasks:**
- *"Add localStorage persistence for metronome preferences"* — update `useAppStore.js` to use Zustand's persist middleware
- *"Fix the local copy of Set feature"* — `SetlistDetail.jsx` and `SetEditor.jsx`, use `isLocalCopy` to create an independent `setEntries` copy
- *"Add per-song Song Starter bar count"* — add `starterBars` field to the `songs` table in `db.js` (bump to version 2), surface in `SongLibrary.jsx` song editor
- *"Add app icons"* — create `public/icons/icon-192.png` and `icon-512.png`, the PWA manifest already references them
- *"Add a settings page metronome defaults"* — extend `Settings.jsx` with sound/volume/pitch pickers that write to localStorage

---

## Future: Accounts & Cloud Sync

Currently all data lives in the browser's IndexedDB on each device. Data does not sync between devices — the JSON export/import in Settings is the manual workaround.

### When to add accounts
Add accounts when users consistently need their data on multiple devices simultaneously and the export/import workflow becomes too painful.

### Recommended approach: Supabase

[Supabase](https://supabase.com) is the lowest-friction path given the existing stack:
- Postgres database (data model maps directly to existing tables)
- Built-in auth (email/password, magic link, OAuth via Google/Apple)
- JavaScript client that works alongside or replaces Dexie
- Generous free tier

### What to build

1. **Auth layer** — signup/login UI, session management via Supabase JS client
2. **Server-side schema** — mirror the existing IndexedDB tables in Postgres, scoped by `user_id`
3. **Sync strategy** — two options:
   - *Replace local*: drop Dexie entirely, query Supabase directly (requires internet)
   - *Local-first with sync*: keep Dexie as the local cache, sync to Supabase in the background (works offline, more complex)
   - **Recommended:** local-first with sync — preserves the offline-first principle of the app
4. **Migration** — on first login, offer to upload existing local data to the new account
5. **Conflict resolution** — use `updatedAt` timestamps (already on songs) to pick the most recent version on conflict

### Files that would change
- `src/db/db.js` — add sync layer or replace with Supabase client
- `src/store/useAppStore.js` — add auth state (currentUser, isLoggedIn)
- `src/App.jsx` — add login gate / auth flow
- `src/components/Settings.jsx` — add account management section
- New: `src/lib/supabase.js` — Supabase client init
- New: `src/components/AuthModal.jsx` — login/signup UI

---

## Running & Deploying

```bash
# Dev
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

The `dist/` folder is a fully self-contained PWA. Deploy to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages). No server required.
