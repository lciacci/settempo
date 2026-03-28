import { useRef, useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppStore } from '../store/useAppStore'
import { useMetronome } from '../hooks/useMetronome'
import { db } from '../db/db'

const TIME_SIG_PRESETS = [
  { label: '4/4', n: 4, d: 4 },
  { label: '3/4', n: 3, d: 4 },
  { label: '6/8', n: 6, d: 8 },
  { label: '7/8', n: 7, d: 8 },
  { label: '5/4', n: 5, d: 4 },
  { label: '12/8', n: 12, d: 8 },
]

const SOUNDS = ['beep', 'woodblock', 'cowbell']
const STARTER_BAR_PRESETS = [1, 2, 4, 8]

function ScrewHead({ className = '' }) {
  return <div className={className}><div className="screw-head" /></div>
}

export default function Metronome({ songStarterConfig, onStarterDone }) {
  const { metronome, setMetronome, performance: perfState, setPerformance } = useAppStore()
  const { start, stop, toggle } = useMetronome()

  const {
    bpm, isPlaying, timeSignatureNumerator, timeSignatureDenominator,
    currentBeat, currentBar, volume, pitch, sound, muted,
    gapClickEnabled, gapClickBars, gapSilentBars, gapPhaseIsClick,
  } = metronome

  const [isStarterMode, setIsStarterMode] = useState(false)

  const starterBarCount = songStarterConfig?.barCount ?? perfState.starterBarCount
  const starterBarsLeft = isPlaying && isStarterMode && starterBarCount > 0
    ? Math.max(0, starterBarCount - currentBar)
    : null

  const recentSongs = useLiveQuery(
    () => db.songs.orderBy('id').reverse().limit(4).toArray(),
    []
  )

  // Tap tempo
  const tapTimesRef = useRef([])
  const tapResetRef = useRef(null)

  const handleTap = useCallback(() => {
    const now = window.performance.now()
    clearTimeout(tapResetRef.current)
    tapResetRef.current = setTimeout(() => { tapTimesRef.current = [] }, 3000)
    tapTimesRef.current.push(now)
    if (tapTimesRef.current.length > 8) tapTimesRef.current.shift()
    if (tapTimesRef.current.length >= 2) {
      const intervals = []
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1])
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setMetronome({ bpm: Math.min(300, Math.max(1, Math.round(60000 / avg))) })
    }
  }, [setMetronome])

  const triggerStarter = useCallback(() => {
    if (isPlaying && isStarterMode) {
      stop()
      setIsStarterMode(false)
      return
    }
    // Stop regular play if running, then start the starter
    if (isPlaying) stop()
    setIsStarterMode(true)
    start({
      starterBars: starterBarCount,
      onDone: () => { setIsStarterMode(false); onStarterDone?.() },
    })
  }, [isPlaying, isStarterMode, stop, start, starterBarCount, onStarterDone])

  const handleToggle = useCallback(() => {
    setIsStarterMode(false)
    toggle()
  }, [toggle])

  const beats = Array.from({ length: timeSignatureNumerator }, (_, i) => i)

  // VU needle: map BPM (40–240) → angle (−40° to +40°)
  const needleAngle = Math.min(40, Math.max(-40, ((bpm - 40) / 200) * 80 - 40))

  return (
    <div className="pt-6 pb-8 px-4 md:px-12 max-w-6xl mx-auto space-y-8">

      {/* ══ Main Hardware Rack ══ */}
      <div className="relative bg-surface-container-low rounded-2xl p-1 brushed-metal rack-panel overflow-hidden">
        <ScrewHead className="absolute top-4 left-4" />
        <ScrewHead className="absolute top-4 right-4" />
        <ScrewHead className="absolute bottom-4 left-4" />
        <ScrewHead className="absolute bottom-4 right-4" />

        <div className="p-6 md:p-10 space-y-8">

          {/* ── Beat Visualizer ── */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-4 md:gap-6">
              {beats.map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full transition-all duration-75 ${
                    isPlaying && currentBeat === i
                      ? 'bg-primary led-active'
                      : 'bg-surface-container-highest shadow-inner'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono-digital text-[10px] tracking-[0.4em] text-primary/60 uppercase font-black">
              BEAT {isPlaying ? currentBeat + 1 : '–'} / BAR {isPlaying ? currentBar + 1 : '–'}
              {gapClickEnabled && isPlaying && (
                <span className={`ml-2 ${gapPhaseIsClick ? 'text-primary' : 'text-outline'}`}>
                  · {gapPhaseIsClick ? 'CLICK' : 'SILENT'}
                </span>
              )}
            </span>
          </div>

          {/* ── BPM Section ── */}

          {/* Desktop: VU meter + BPM display side-by-side */}
          <div className="hidden lg:grid grid-cols-12 gap-8 items-stretch">

            {/* VU Meter */}
            <div className="col-span-4 bg-surface-container-lowest rounded-lg p-6 h-56 relative rack-module flex flex-col justify-end overflow-hidden">
              <ScrewHead className="absolute top-2 left-2 scale-50 opacity-50" />
              <ScrewHead className="absolute top-2 right-2 scale-50 opacity-50" />
              <ScrewHead className="absolute bottom-2 left-2 scale-50 opacity-50" />
              <ScrewHead className="absolute bottom-2 right-2 scale-50 opacity-50" />
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 4px' }}
              />
              <div className="text-center mb-2">
                <span className="font-mono-digital text-[9px] tracking-[0.2em] text-outline uppercase font-bold">SIGNAL TEMPO</span>
              </div>
              <div className="relative h-28 flex items-end justify-center">
                <div className="absolute inset-x-0 top-0 h-full flex justify-between items-end px-4 opacity-40">
                  <div className="w-0.5 h-8 bg-outline" />
                  <div className="w-0.5 h-6 bg-outline" />
                  <div className="w-0.5 h-6 bg-outline" />
                  <div className="w-0.5 h-6 bg-outline" />
                  <div className="w-0.5 h-10 bg-tertiary" />
                </div>
                <div
                  className="w-0.5 h-36 bg-primary absolute bottom-0 origin-bottom transition-transform duration-150 shadow-[0_0_8px_rgba(255,179,0,0.5)]"
                  style={{ transform: `rotate(${needleAngle}deg)` }}
                />
              </div>
            </div>

            {/* BPM Display */}
            <div className="col-span-8 bg-surface-container-lowest rounded-lg rack-module p-8 flex flex-col items-center justify-center relative shadow-[inset_0_2px_15px_rgba(0,0,0,1)] min-h-[14rem]">
              <div className="absolute top-3 left-6">
                <span className="font-mono-digital text-[10px] tracking-[0.3em] text-primary/40 uppercase font-black">TEMPO OUTPUT</span>
              </div>
              <div className="flex items-center gap-8">
                {/* Fine tune left */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setMetronome({ bpm: Math.max(1, bpm - 5) })}
                    className="w-14 h-10 bg-surface-container-high border-b-2 border-black rounded-sm flex items-center justify-center font-mono-digital text-[10px] text-outline hover:text-primary active:translate-y-0.5 transition-all"
                  >-5</button>
                  <button
                    onClick={() => setMetronome({ bpm: Math.max(1, bpm - 1) })}
                    className="w-14 h-10 bg-surface-container-high border-b-2 border-black rounded-sm flex items-center justify-center font-mono-digital text-[10px] text-outline hover:text-primary active:translate-y-0.5 transition-all"
                  >-1</button>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-[120px] font-black leading-none text-primary seven-segment">{bpm}</span>
                  <span className="text-2xl font-bold text-primary/40 font-headline uppercase tracking-widest">BPM</span>
                </div>

                {/* Fine tune right */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setMetronome({ bpm: Math.min(300, bpm + 1) })}
                    className="w-14 h-10 bg-surface-container-high border-b-2 border-black rounded-sm flex items-center justify-center font-mono-digital text-[10px] text-outline hover:text-primary active:translate-y-0.5 transition-all"
                  >+1</button>
                  <button
                    onClick={() => setMetronome({ bpm: Math.min(300, bpm + 5) })}
                    className="w-14 h-10 bg-surface-container-high border-b-2 border-black rounded-sm flex items-center justify-center font-mono-digital text-[10px] text-outline hover:text-primary active:translate-y-0.5 transition-all"
                  >+5</button>
                </div>
              </div>
              <div className="absolute bottom-3 right-6 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-all ${isPlaying ? 'bg-primary shadow-[0_0_8px_rgba(255,179,0,0.8)]' : 'bg-surface-container-highest'}`} />
                <span className="font-mono-digital text-[9px] tracking-[0.1em] text-primary/80 uppercase">
                  {!isPlaying ? 'STANDBY' : isStarterMode ? 'COUNTING' : 'PLAYING'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile: BPM display only */}
          <div className="lg:hidden bg-surface-container-lowest p-6 rounded-lg border-2 border-surface-container flex flex-col items-center relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.05] z-10"
              style={{ backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 2px' }}
            />
            <span className="font-label text-primary/40 text-[9px] tracking-[0.4em] uppercase mb-1">TEMPO READOUT</span>
            <div className="text-8xl font-mono-digital font-bold text-primary seven-segment tracking-tighter leading-none py-2">{bpm}</div>
            <span className="font-label text-primary/40 text-[9px] tracking-[0.4em] uppercase mt-1">BPM / QUARTER</span>
          </div>

          {/* Mobile: fine-tune buttons */}
          <div className="lg:hidden grid grid-cols-4 gap-3">
            {[
              { label: '-5', delta: -5, icon: 'keyboard_double_arrow_left' },
              { label: '-1', delta: -1, icon: 'chevron_left' },
              { label: '+1', delta:  1, icon: 'chevron_right' },
              { label: '+5', delta:  5, icon: 'keyboard_double_arrow_right' },
            ].map(({ label, delta, icon }) => (
              <button
                key={label}
                onClick={() => setMetronome({ bpm: Math.min(300, Math.max(1, bpm + delta)) })}
                className="bg-surface-container-high aspect-square rounded font-mono-digital text-on-surface-variant hover:bg-surface-container-highest active:scale-95 transition-all flex flex-col items-center justify-center border border-white/5 gap-1"
              >
                <span className="text-[10px] opacity-40">{label}</span>
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </button>
            ))}
          </div>

          {/* ── Middle Row: Time Sig + Transport + Click Tone (desktop) ── */}
          <div className="hidden md:grid grid-cols-3 gap-8">

            {/* Time Signature */}
            <div className="bg-surface-container-high p-6 rounded-lg rack-module relative">
              <ScrewHead className="absolute top-2 left-2 scale-50 opacity-30" />
              <ScrewHead className="absolute top-2 right-2 scale-50 opacity-30" />
              <div className="mb-6 text-center">
                <span className="font-mono-digital text-[9px] tracking-[0.2em] text-on-surface-variant uppercase font-bold">TIME SIGNATURE</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SIG_PRESETS.map(({ label, n, d }) => {
                  const active = timeSignatureNumerator === n && timeSignatureDenominator === d
                  return (
                    <button
                      key={label}
                      onClick={() => setMetronome({ timeSignatureNumerator: n, timeSignatureDenominator: d })}
                      className={`py-2 px-1 bg-surface-container-lowest text-[10px] font-mono-digital font-bold transition-all ${
                        active
                          ? 'border-b-2 border-primary text-primary shadow-[0_0_10px_rgba(255,215,155,0.15)]'
                          : 'border-b-2 border-black text-outline hover:text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Transport */}
            <div className="flex flex-col items-center justify-center gap-6">
              <button
                onClick={handleToggle}
                className="relative w-36 h-36 rounded-full bg-surface-container-high border-[10px] border-surface-container-highest shadow-[0_15px_40px_rgba(0,0,0,0.6),inset_0_2px_5px_rgba(255,255,255,0.05)] active:translate-y-1 active:shadow-inner transition-all flex items-center justify-center"
              >
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isPlaying && !isStarterMode ? 'btn-red-backlit' : 'btn-amber-backlit'}`}>
                  <span
                    className="material-symbols-outlined text-[#281900] text-6xl"
                    style={{ fontVariationSettings: "'FILL' 1", fontSize: '4rem' }}
                  >
                    {isPlaying && !isStarterMode ? 'stop' : 'play_arrow'}
                  </span>
                </div>
              </button>
              <button
                onClick={handleTap}
                className="px-8 py-2 bg-surface-container-high rounded-sm text-[9px] tracking-[0.3em] font-black text-on-surface hover:bg-surface-container-highest transition-colors border-b-2 border-black shadow-md uppercase"
              >
                TAP TEMPO
              </button>
            </div>

            {/* Click Tone */}
            <div className="bg-surface-container-high p-6 rounded-lg rack-module relative">
              <ScrewHead className="absolute top-2 left-2 scale-50 opacity-30" />
              <ScrewHead className="absolute top-2 right-2 scale-50 opacity-30" />
              <div className="mb-6 text-center">
                <span className="font-mono-digital text-[9px] tracking-[0.2em] text-on-surface-variant uppercase font-bold">CLICK TONE</span>
              </div>
              <div className="space-y-2">
                {SOUNDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMetronome({ sound: s })}
                    className={`w-full py-2.5 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all capitalize ${
                      sound === s
                        ? 'bg-[#FFB300] text-on-primary-fixed shadow-[0_0_20px_rgba(255,179,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border-t border-white/20'
                        : 'bg-surface-container-lowest text-outline border border-white/5 hover:text-primary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Mobile: Selectors + Tap ── */}
          <div className="md:hidden space-y-4">

            {/* Transport */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleToggle}
                className="relative w-36 h-36 rounded-full bg-surface-container-high border-[10px] border-surface-container-highest shadow-[0_15px_40px_rgba(0,0,0,0.6),inset_0_2px_5px_rgba(255,255,255,0.05)] active:translate-y-1 active:shadow-inner transition-all flex items-center justify-center"
              >
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isPlaying && !isStarterMode ? 'btn-red-backlit' : 'btn-amber-backlit'}`}>
                  <span
                    className="material-symbols-outlined text-[#281900] text-6xl"
                    style={{ fontVariationSettings: "'FILL' 1", fontSize: '4rem' }}
                  >
                    {isPlaying && !isStarterMode ? 'stop' : 'play_arrow'}
                  </span>
                </div>
              </button>
              <button
                onClick={handleTap}
                className="px-8 py-2 bg-surface-container-high rounded-sm text-[9px] tracking-[0.3em] font-black text-on-surface hover:bg-surface-container-highest transition-colors border-b-2 border-black shadow-md uppercase"
              >
                TAP TEMPO
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5 bg-surface-container-low p-5 rounded-lg border border-surface-container-highest">
              {/* Time Signature */}
              <div className="flex flex-col gap-3">
                <label className="font-label text-[10px] text-primary/40 tracking-[0.2em] uppercase">Time Signature</label>
                <div className="space-y-2">
                  {TIME_SIG_PRESETS.slice(0, 3).map(({ label, n, d }) => {
                    const active = timeSignatureNumerator === n && timeSignatureDenominator === d
                    return (
                      <button
                        key={label}
                        onClick={() => setMetronome({ timeSignatureNumerator: n, timeSignatureDenominator: d })}
                        className={`w-full py-3 text-xs font-mono-digital rounded transition-colors ${
                          active
                            ? 'bg-surface-container-high border-l-4 border-primary text-primary'
                            : 'bg-surface-container-lowest text-on-surface-variant/40'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Sound Profile */}
              <div className="flex flex-col gap-3">
                <label className="font-label text-[10px] text-primary/40 tracking-[0.2em] uppercase">Sound Profile</label>
                <div className="space-y-2">
                  {SOUNDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setMetronome({ sound: s })}
                      className={`w-full py-3 text-xs font-label font-bold rounded uppercase transition-colors ${
                        sound === s
                          ? 'bg-primary text-on-primary shadow-lg'
                          : 'bg-surface-container-lowest text-on-surface-variant/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ── Bottom Modules: Song Starter + Gap Click ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Song Starter */}
            <div className="bg-surface-container-high p-6 rounded-lg rack-module space-y-4 relative">
              <ScrewHead className="absolute bottom-2 left-2 scale-50 opacity-30" />
              <ScrewHead className="absolute bottom-2 right-2 scale-50 opacity-30" />

              <div className="flex justify-between items-center">
                <h3 className="font-mono-digital text-primary/80 text-[10px] font-black uppercase tracking-[0.2em]">SONG_STARTER</h3>
                {/* Active indicator LED */}
                <div className={`hidden md:flex w-3 h-3 rounded-full transition-all ${isPlaying && isStarterMode ? 'bg-primary shadow-[0_0_8px_rgba(255,215,155,0.8)]' : 'bg-surface-container-lowest shadow-inner'}`} />
                {/* Mobile: bar count display */}
                <span className="md:hidden font-mono font-bold text-xl text-on-surface">
                  BARS: <span className="text-primary">{String(starterBarCount).padStart(2, '0')}</span>
                </span>
              </div>

              {/* Desktop: bar count presets */}
              <div className="hidden md:flex items-center gap-4">
                <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest min-w-[40px]">BARS:</span>
                <div className="flex gap-1.5 flex-1">
                  {STARTER_BAR_PRESETS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPerformance({ starterBarCount: n })}
                      className={`flex-1 py-1.5 text-[9px] font-mono-digital font-bold rounded-sm transition-all ${
                        starterBarCount === n
                          ? 'bg-[#9B2226] text-white shadow-[0_0_10px_rgba(155,34,38,0.3)]'
                          : 'bg-surface-container-lowest text-outline border border-white/5'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile: +/- bar controls */}
              <div className="flex md:hidden gap-2 justify-end">
                <button
                  onClick={() => setPerformance({ starterBarCount: Math.max(1, starterBarCount - 1) })}
                  className="w-12 h-12 bg-[#9B2226] red-glow flex items-center justify-center text-white rounded active:scale-90 transition-all border-b-2 border-black/30"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <button
                  onClick={() => setPerformance({ starterBarCount: Math.min(32, starterBarCount + 1) })}
                  className="w-12 h-12 bg-[#9B2226] red-glow flex items-center justify-center text-white rounded active:scale-90 transition-all border-b-2 border-black/30"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>

              {/* Trigger button */}
              <button
                onClick={triggerStarter}
                className={`w-full py-4 text-white font-mono-digital font-black text-xs uppercase tracking-[0.2em] rounded-sm flex items-center justify-center gap-2 border-t border-white/10 active:scale-[0.98] transition-all ${isPlaying && isStarterMode ? 'btn-amber-backlit' : 'btn-red-backlit'}`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1rem' }}>
                  {isPlaying && isStarterMode ? 'stop' : 'play_arrow'}
                </span>
                <span className="hidden md:inline">
                  {isPlaying && isStarterMode
                    ? `STOP (${starterBarsLeft ?? '…'} LEFT)`
                    : `COUNT ${starterBarCount} BAR${starterBarCount !== 1 ? 'S' : ''}`}
                </span>
                <span className="md:hidden">
                  {isPlaying && isStarterMode ? 'STOP SESSION' : 'START SESSION'}
                </span>
              </button>
            </div>

            {/* Gap Click (desktop only) */}
            <div className="hidden md:block bg-surface-container-high p-6 rounded-lg rack-module space-y-4 relative">
              <ScrewHead className="absolute bottom-2 left-2 scale-50 opacity-30" />
              <ScrewHead className="absolute bottom-2 right-2 scale-50 opacity-30" />

              <div className="flex justify-between items-center">
                <h3 className="font-mono-digital text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">GAP_CLICK</h3>
                <button
                  onClick={() => setMetronome({ gapClickEnabled: !gapClickEnabled })}
                  className={`px-3 py-1 text-[9px] font-mono-digital font-bold uppercase tracking-widest rounded-sm border shadow-inner transition-all ${
                    gapClickEnabled
                      ? 'bg-primary text-on-primary-fixed border-primary/50'
                      : 'bg-surface-container-lowest text-outline border-white/5'
                  }`}
                >
                  {gapClickEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {[
                  { key: 'gapClickBars',   label: 'CLICK_BARS',  val: gapClickBars },
                  { key: 'gapSilentBars',  label: 'SILENT_BARS', val: gapSilentBars },
                ].map(({ key, label, val }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">{label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMetronome({ [key]: Math.max(1, val - 1) })}
                        className="w-6 h-6 bg-surface-container flex items-center justify-center text-outline hover:text-primary text-xs rounded-sm"
                      >−</button>
                      <div className="w-14 h-8 bg-surface-container-lowest rounded-sm border border-white/5 flex items-center justify-center shadow-inner">
                        <span className="font-mono-digital text-xs font-bold text-primary">{val}</span>
                      </div>
                      <button
                        onClick={() => setMetronome({ [key]: Math.min(32, val + 1) })}
                        className="w-6 h-6 bg-surface-container flex items-center justify-center text-outline hover:text-primary text-xs rounded-sm"
                      >+</button>
                    </div>
                  </div>
                ))}
                {gapClickEnabled && isPlaying && (
                  <div className={`text-center py-1.5 rounded-sm font-mono-digital text-[9px] font-bold uppercase tracking-widest ${gapPhaseIsClick ? 'text-primary' : 'text-outline'}`}>
                    {gapPhaseIsClick ? '● CLICK PHASE' : '○ SILENT PHASE'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Faders (desktop only) ── */}
          <div className="hidden md:grid grid-cols-2 gap-12 pt-10 border-t border-white/5">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-mono-digital text-[9px] font-black tracking-widest text-outline uppercase">MASTER_VOL</span>
                <span className="font-mono-digital text-[10px] font-bold text-primary">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={(e) => setMetronome({ volume: Number(e.target.value) })}
                className="hardware-fader"
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-mono-digital text-[9px] font-black tracking-widest text-outline uppercase">PITCH_ST</span>
                <span className="font-mono-digital text-[10px] font-bold text-primary">{pitch > 0 ? `+${pitch}` : pitch} ST</span>
              </div>
              <input
                type="range" min={-12} max={12} step={1} value={pitch}
                onChange={(e) => setMetronome({ pitch: Number(e.target.value) })}
                className="hardware-fader"
              />
            </div>
          </div>

          {/* ── Audio Status (desktop only) ── */}
          <div className="hidden md:flex justify-center pt-2">
            <button
              onClick={() => setMetronome({ muted: !muted })}
              className={`flex items-center gap-2 px-6 py-2 rounded-full border text-on-surface-variant hover:text-primary transition-colors shadow-inner ${
                muted
                  ? 'border-outline/50 bg-surface-container text-outline'
                  : 'border-white/5 bg-surface-container-lowest'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{muted ? 'volume_off' : 'volume_up'}</span>
              <span className="font-mono-digital text-[9px] font-bold uppercase tracking-widest">
                {muted ? 'AUDIO_MUTED' : 'AUDIO_ONLINE'}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* ══ Recent Sessions ══ */}
      {recentSongs && recentSongs.length > 0 && (
        <div className="relative bg-surface-container-low rounded-2xl p-1 brushed-metal rack-panel">
          <ScrewHead className="absolute top-4 left-4" />
          <ScrewHead className="absolute top-4 right-4" />
          <ScrewHead className="absolute bottom-4 left-4" />
          <ScrewHead className="absolute bottom-4 right-4" />
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-end mb-6 md:mb-8 border-b border-white/5 pb-4">
              <div>
                <span className="font-mono-digital text-[9px] tracking-[0.2em] text-on-surface-variant uppercase font-bold">SUB_PANEL_02</span>
                <h2 className="text-lg md:text-xl font-headline font-black text-on-surface uppercase tracking-tighter">RECENT SESSIONS</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {recentSongs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => setMetronome({
                    bpm: song.bpm ?? bpm,
                    timeSignatureNumerator: song.timeSignatureNumerator ?? timeSignatureNumerator,
                    timeSignatureDenominator: song.timeSignatureDenominator ?? timeSignatureDenominator,
                  })}
                  className="bg-surface-container-lowest p-3 md:p-4 rounded-sm flex items-center gap-3 md:gap-4 hover:bg-surface-container-high transition-colors cursor-pointer rack-module"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-container-high rounded-sm flex items-center justify-center border border-white/5 shadow-inner flex-shrink-0">
                    <span className="material-symbols-outlined text-primary">audiotrack</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-[11px] font-bold text-on-surface font-mono-digital truncate uppercase">{song.title}</div>
                    <div className="text-[9px] text-on-surface-variant font-mono-digital">
                      {song.bpm ? `${song.bpm} BPM` : '– BPM'} / {song.timeSignatureNumerator ?? 4}-{song.timeSignatureDenominator ?? 4}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
