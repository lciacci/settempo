import { create } from 'zustand'

// System log retention. Long enough to read back a whole session's worth of
// operations, short enough not to grow without bound.
const LOG_LIMIT = 200

// How many toasts can be on screen at once. Small: past this the stack stops
// being a notification and starts being an obstruction.
const TOAST_LIMIT = 3

export const useAppStore = create((set) => ({
  // ── System log + toasts ──────────────────────────────────────────────────
  // One store, two surfaces. `notify()` writes a durable entry to the system
  // log *and* raises a transient toast. The toast is the surface you can't
  // miss; the log is the record you can go back and read. Nothing a toast
  // says is lost when it fades.
  //
  // The log is stored newest-first so display order needs no reversal and
  // trimming drops the oldest entries, which is what `slice` does naturally.
  systemLog: [{ id: 0, level: 'info', text: 'SYSTEM READY', at: null }],
  toasts: [],
  logSeq: 1,

  notify: (text, level = 'info') =>
    set((state) => {
      const entry = { id: state.logSeq, level, text, at: Date.now() }
      return {
        logSeq: state.logSeq + 1,
        // The log records every occurrence — that is the point of it.
        systemLog: [entry, ...state.systemLog].slice(0, LOG_LIMIT),
        // The toast stack does not. Errors never auto-dismiss, and auto-sync
        // retries every 60s, so an offline device would otherwise stack an
        // identical toast per minute until it covered the screen. Drop any
        // visible toast with the same text, then cap the stack. Nothing is
        // lost: the repetition is still in the log.
        toasts: [...state.toasts.filter((t) => t.text !== text), entry].slice(-TOAST_LIMIT),
      }
    }),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // Log without raising a toast. For diagnostics the user did not ask for
  // and should not be interrupted by — a muted metronome is expected
  // behaviour, not a fault, but it is worth being able to read back when
  // someone reports "no sound".
  logQuietly: (text) =>
    set((state) => ({
      logSeq: state.logSeq + 1,
      systemLog: [
        { id: state.logSeq, level: 'info', text, at: Date.now() },
        ...state.systemLog,
      ].slice(0, LOG_LIMIT),
    })),

  // Navigation
  currentArtistId: null,
  setCurrentArtistId: (id) => set({ currentArtistId: id }),

  // Sub-navigation stack: [{ view, params }]
  navStack: [],
  pushView: (view, params = {}) =>
    set((state) => ({ navStack: [...state.navStack, { view, params }] })),
  popView: () =>
    set((state) => ({ navStack: state.navStack.slice(0, -1) })),
  resetNav: () => set({ navStack: [] }),

  // Metronome state
  metronome: {
    bpm: 120,
    isPlaying: false,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    currentBeat: 0,
    currentBar: 0,
    volume: 0.8,
    pitch: 0,         // semitones, -12 to +12
    sound: 'beep',    // 'beep' | 'woodblock' | 'cowbell'
    muted: false,
    // Song Starter
    starterDone: false,   // flips to true when starter finishes
    // Gap Click
    gapClickEnabled: false,
    gapClickBars: 2,
    gapSilentBars: 2,
    gapPhaseIsClick: true,  // visual: current phase
  },
  setMetronome: (patch) =>
    set((state) => ({ metronome: { ...state.metronome, ...patch } })),

  // Performance mode
  performance: {
    active: false,
    setlistId: null,
    songIndex: 0,
    autoStartMetronome: false,
    afterStarterFinish: 'stop', // 'stop' | 'advance'
    starterBarCount: 2,
  },
  setPerformance: (patch) =>
    set((state) => ({ performance: { ...state.performance, ...patch } })),
}))
