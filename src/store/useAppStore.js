import { create } from 'zustand'

export const useAppStore = create((set) => ({
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
