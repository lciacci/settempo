# SetTempo

A React PWA metronome and setlist manager built with an **Analog Precision** hardware rack aesthetic.

## Stack

- **React 19** + **Vite 7**
- **Tailwind CSS v4** (`@tailwindcss/vite`) — custom design tokens via `@theme` in `src/index.css`
- **Zustand** — app state (`useAppStore`)
- **Dexie.js** + **dexie-react-hooks** — IndexedDB for artists, songs, sets, setlists, shows
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

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
```

## Testing

**No test framework is currently installed.**

### Assessment

The app is UI-heavy with several dependencies (Web Audio API, IndexedDB/Dexie, @dnd-kit) that are difficult to test in a headless environment. A full component test suite would have a high setup cost relative to its value.

### What is worth testing (pure logic layer)

| Target | File | Effort | Value |
|---|---|---|---|
| Import parsers | `src/components/SongImport.jsx` — `guessMapping`, `parseTimeSig`, `validateRow`, `buildSong` | ~20 min | High — catches regressions in CSV/XLSX import |
| Export builder | `src/components/SetlistExport.jsx` — `buildSetlistData` | ~15 min | High — pure function, easy to assert |
| Store transitions | `src/store/useAppStore.js` | ~15 min | Medium — Zustand stores test cleanly |
| BPM math | `src/hooks/useMetronome.js` — `semitoneRatio` | ~10 min | Low — trivial function |

### What is not worth testing

- **Components** — Dexie mocking + DnD interaction simulation is a significant rabbit hole
- **Web Audio API** — requires a browser, `AudioContext` is not available in jsdom
- **Visual/layout correctness** — not automatable; use manual review

### Setup cost if adding Vitest (~10 min)

```bash
npm install -D vitest jsdom
```

Add to `vite.config.js`:
```js
test: {
  environment: 'jsdom',
}
```

Add to `package.json` scripts:
```json
"test": "vitest"
```

### Current QA approach
- Code review passes (ask Claude to review before shipping)
- Manual testing on target devices (desktop Chrome/Safari, Android Chrome, iOS Safari/Chrome)
- `npm run build` as a smoke test — catches import errors and type issues at build time

## Roadmap

1. ~~Finish redesign~~ — all components on Analog Precision aesthetic ✓
2. ~~Performance Mode polish~~ — song notes display, clearer AUTO-START toggle ✓
3. ~~Quick-load from Song Library~~ — loads song to metronome and switches to Tempo tab ✓
4. **PWA manifest & icons** — custom icons matching Analog Precision aesthetic + SetTempo favicon
5. **Sync / accounts** — `sensors` icon in header is placeholder; needs backend
