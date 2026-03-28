import { useEffect, useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { useMetronome } from '../hooks/useMetronome'
import { useWakeLock } from '../hooks/useWakeLock'

function useSetlistSongs(setlistId) {
  return useLiveQuery(async () => {
    if (!setlistId) return []
    const slSets = await db.setlistSets.where('setlistId').equals(setlistId).filter(r => !r.deletedAt).sortBy('position')
    const result = []
    for (const slSet of slSets) {
      const set = await db.sets.get(slSet.setId)
      const entries = await db.setEntries.where('setId').equals(slSet.setId).filter(e => !e.deletedAt).sortBy('position')
      for (const entry of entries) {
        const song = await db.songs.get(entry.songId)
        if (song && !song.deletedAt) {
          result.push({
            entryId: entry.id,
            songId: song.id,
            title: song.title,
            bpm: entry.bpmOverride ?? song.bpm,
            timeSigN: entry.timeSigNOverride ?? song.timeSigN,
            timeSigD: entry.timeSigDOverride ?? song.timeSigD,
            notes: entry.notesOverride ?? song.notes ?? '',
            setName: set?.name ?? '',
          })
        }
      }
    }
    return result
  }, [setlistId])
}

function ScrewDot({ className = '' }) {
  return (
    <div className={`fixed opacity-20 pointer-events-none ${className}`}>
      <span className="material-symbols-outlined text-xs text-outline" style={{ fontSize: '0.75rem' }}>fiber_manual_record</span>
    </div>
  )
}

export default function PerformanceMode({ setlistId, onExit, onExitTo }) {
  const { metronome, setMetronome, performance, setPerformance } = useAppStore()
  const { start, stop } = useMetronome()
  const { acquire, release } = useWakeLock()
  const [starterRunning, setStarterRunning] = useState(false)

  const songs = useSetlistSongs(setlistId)
  const songIndex = performance.songIndex
  const currentSong = songs?.[songIndex]
  const nextSong = songs?.[songIndex + 1]

  const { isPlaying, currentBeat, timeSignatureNumerator } = metronome
  const starterBarCount = performance.starterBarCount
  const afterStarterFinish = performance.afterStarterFinish
  const autoStart = performance.autoStartMetronome

  useEffect(() => {
    acquire()
    return () => { release(); stop() }
  }, [acquire, release, stop])

  useEffect(() => {
    if (!currentSong) return
    setMetronome({
      bpm: currentSong.bpm,
      timeSignatureNumerator: currentSong.timeSigN,
      timeSignatureDenominator: currentSong.timeSigD,
    })
  }, [currentSong, setMetronome])

  const goToSong = useCallback((index) => {
    if (!songs || index < 0 || index >= songs.length) return
    stop()
    setStarterRunning(false)
    setPerformance({ songIndex: index })
    if (autoStart) {
      const song = songs[index]
      setTimeout(() => {
        setMetronome({
          bpm: song.bpm,
          timeSignatureNumerator: song.timeSigN,
          timeSignatureDenominator: song.timeSigD,
        })
        start()
      }, 50)
    }
  }, [songs, stop, start, setMetronome, setPerformance, autoStart])

  const advance = useCallback(() => {
    if (songs && songIndex < songs.length - 1) goToSong(songIndex + 1)
  }, [songs, songIndex, goToSong])

  const triggerStarter = useCallback(() => {
    if (starterRunning || isPlaying) {
      stop()
      setStarterRunning(false)
      return
    }
    setStarterRunning(true)
    start({
      starterBars: starterBarCount,
      onDone: () => {
        setStarterRunning(false)
        if (afterStarterFinish === 'advance') advance()
      },
    })
  }, [starterRunning, isPlaying, stop, start, starterBarCount, afterStarterFinish, advance])

  const beats = Array.from({ length: timeSignatureNumerator }, (_, i) => i)
  const songNum = (n) => String(n).padStart(2, '0')
  const isActive = isPlaying || starterRunning

  if (!songs) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <span className="font-mono-digital text-primary/40 tracking-widest text-sm uppercase">LOADING…</span>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-6 z-50">
        <p className="font-mono-digital text-outline text-sm uppercase tracking-widest">No songs in setlist</p>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-surface-container-high text-on-surface font-headline font-bold uppercase tracking-widest text-sm hover:bg-surface-container-highest transition-colors rounded"
        >
          EXIT
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background text-on-background font-body select-none overflow-hidden z-50 flex flex-col">

      {/* Noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Header ── */}
      <header className="bg-surface-container-low border-b-4 border-background z-50 h-16 flex items-center justify-between px-6 flex-shrink-0 shadow-[inset_0_-1px_0_0_rgba(255,215,155,0.1)]">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-tighter text-primary font-headline">ANALOG_PRECISION</span>
          <div className="h-4 w-px bg-surface-container-high" />
          <span className="font-headline uppercase tracking-widest text-xs font-bold text-primary drop-shadow-[0_0_8px_rgba(255,215,155,0.6)] hidden sm:block">
            PERFORMANCE_MODE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPerformance({ autoStartMetronome: !autoStart })}
            className={`flex items-center gap-1.5 font-mono-digital text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-all ${
              autoStart
                ? 'border-primary/50 bg-surface-container text-primary shadow-[0_0_8px_rgba(255,179,0,0.2)]'
                : 'border-surface-container-highest bg-surface-container-low text-outline hover:text-primary hover:border-outline-variant'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${autoStart ? 'bg-primary-container shadow-[0_0_6px_#FFB300]' : 'bg-surface-container-highest'}`} />
            Auto-Start
          </button>
          <button onClick={onExit} className="text-primary hover:brightness-125 transition-all">
            <span className="material-symbols-outlined">power_settings_new</span>
          </button>
        </div>
      </header>

      {/* ── Main canvas ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-4 md:py-6 overflow-hidden">
        <div className="w-full max-w-6xl flex flex-col gap-4 md:gap-6 h-full justify-center">

          {/* Song Info Bar */}
          <div className="border-b-2 border-surface-container-high pb-4 flex-shrink-0 space-y-2">
            <div className="flex justify-between items-end gap-4">
              <div className="space-y-1 min-w-0">
                <p className="font-label text-xs tracking-[0.3em] text-outline uppercase">Current Song</p>
                <h1 className="font-headline text-2xl md:text-4xl font-bold tracking-tight text-on-surface truncate">
                  {songNum(songIndex + 1)}. {currentSong?.title?.toUpperCase()}
                </h1>
              </div>
              {nextSong ? (
                <div className="text-right space-y-1 opacity-60 flex-shrink-0">
                  <p className="font-label text-xs tracking-[0.3em] text-outline uppercase">Next Cue</p>
                  <h2 className="font-headline text-lg md:text-2xl font-medium tracking-tight text-on-surface-variant">
                    {songNum(songIndex + 2)}. {nextSong.title?.toUpperCase()}
                  </h2>
                </div>
              ) : (
                <div className="text-right opacity-40 flex-shrink-0">
                  <p className="font-label text-xs tracking-[0.3em] text-outline uppercase">End of Set</p>
                </div>
              )}
            </div>
            {currentSong?.notes ? (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-outline flex-shrink-0">sticky_note_2</span>
                <p className="font-mono-digital text-[10px] md:text-xs text-on-surface-variant uppercase tracking-wide truncate">
                  {currentSong.notes}
                </p>
              </div>
            ) : null}
          </div>

          {/* Central Dashboard */}
          <div className="grid grid-cols-12 gap-4 md:gap-6 flex-1 min-h-0">

            {/* BPM Display Module */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container-low p-1 rounded-lg border border-outline-variant/20 shadow-2xl min-h-0">
              <div className="bg-surface-container-lowest h-full rounded p-6 md:p-10 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <div className="absolute top-4 left-6 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full transition-all ${isActive ? 'bg-secondary shadow-[0_0_10px_#9bd2b7]' : 'bg-surface-container-highest'}`} />
                  <span className={`font-label text-[10px] tracking-widest uppercase font-bold transition-colors ${isActive ? 'text-secondary' : 'text-outline'}`}>
                    {isActive ? 'SIGNAL_LOCKED' : 'STANDBY'}
                  </span>
                </div>

                <div className="flex flex-col items-center w-full">
                  <span className="font-label text-sm tracking-[0.5em] text-primary/40 uppercase font-black mb-2 md:mb-4">Beats Per Minute</span>
                  <div className="segment-display text-[5rem] sm:text-[8rem] md:text-[12rem] lg:text-[14rem] font-bold leading-none text-primary tracking-tighter select-none seven-segment">
                    {metronome.bpm}
                  </div>

                  {/* Beat pulse bar */}
                  <div className="w-full mt-4 md:mt-6 h-3 md:h-4 bg-surface-container-high rounded-full overflow-hidden flex gap-1 p-1">
                    {beats.map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-75 ${
                          isActive && currentBeat === i
                            ? 'bg-primary shadow-[0_0_15px_#ffd79b]'
                            : 'bg-surface-container-highest'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Controls */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 md:gap-6 min-h-0">

              {/* Time Signature */}
              <div className="flex-1 bg-surface-container-low p-4 md:p-6 rounded-lg flex flex-col justify-between border border-outline-variant/20 min-h-0">
                <p className="font-label text-xs tracking-[0.3em] text-outline uppercase font-bold">Time Signature</p>
                <div className="flex items-center justify-center gap-4 py-4 md:py-6">
                  <span className="font-headline text-5xl md:text-7xl lg:text-8xl font-black text-on-surface">
                    {currentSong?.timeSigN ?? 4}
                  </span>
                  <div className="h-10 md:h-16 w-px bg-outline-variant/30 rotate-12" />
                  <span className="font-headline text-5xl md:text-7xl lg:text-8xl font-black text-on-surface">
                    {currentSong?.timeSigD ?? 4}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => goToSong(songIndex - 1)}
                    disabled={songIndex === 0}
                    className="bg-surface-container-high text-on-surface py-3 font-label text-xs tracking-widest hover:bg-surface-bright active:scale-95 transition-all uppercase font-bold disabled:opacity-30 rounded-sm"
                  >
                    Shift −
                  </button>
                  <button
                    onClick={() => goToSong(songIndex + 1)}
                    disabled={!nextSong}
                    className="bg-surface-container-high text-on-surface py-3 font-label text-xs tracking-widest hover:bg-surface-bright active:scale-95 transition-all uppercase font-bold disabled:opacity-30 rounded-sm"
                  >
                    Shift +
                  </button>
                </div>
              </div>

              {/* Next Song Cue */}
              <button
                onClick={advance}
                disabled={!nextSong}
                className="bg-surface-container-high hover:bg-surface-bright border border-outline-variant/30 group p-4 md:p-6 rounded-lg transition-all flex items-center justify-between disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <div className="text-left">
                  <p className="font-label text-[10px] tracking-[0.3em] text-outline uppercase font-bold group-hover:text-primary transition-colors">
                    Arm Next Track
                  </p>
                  <p className="font-headline text-base md:text-lg font-bold text-on-surface">
                    {nextSong ? `${songNum(songIndex + 2)}. ${nextSong.title?.toUpperCase()}` : 'END OF SET'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-3xl md:text-4xl text-outline group-hover:text-primary transition-all group-active:translate-x-2">
                  skip_next
                </span>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-12 gap-4 md:gap-6 flex-shrink-0">

            {/* Panic Stop */}
            <div className="col-span-4">
              <button
                onClick={stop}
                className="w-full h-20 md:h-28 bg-surface-container-low border border-outline-variant/20 rounded-lg flex flex-col items-center justify-center gap-1 md:gap-2 hover:bg-surface-container-high active:scale-95 transition-all group"
              >
                <span className="material-symbols-outlined text-2xl md:text-4xl text-tertiary">emergency_home</span>
                <span className="font-label text-[9px] md:text-xs tracking-widest text-outline uppercase font-bold group-hover:text-tertiary transition-colors">
                  Panic Stop
                </span>
              </button>
            </div>

            {/* START_PRECISION */}
            <div className="col-span-8">
              <button
                onClick={triggerStarter}
                className={`w-full h-20 md:h-28 rounded-lg flex items-center justify-center gap-3 md:gap-6 active:scale-95 transition-all ${
                  isActive
                    ? 'bg-[#9B2226] shadow-[0_0_40px_rgba(155,34,38,0.4)] hover:brightness-110'
                    : 'bg-primary text-on-primary shadow-[0_0_40px_rgba(255,215,155,0.3)] hover:brightness-110'
                }`}
              >
                <span
                  className="material-symbols-outlined text-4xl md:text-6xl"
                  style={{ fontVariationSettings: "'FILL' 1", fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
                >
                  {isActive ? 'stop' : 'play_arrow'}
                </span>
                <div className="text-left">
                  <span className={`block font-headline text-xl md:text-3xl font-black tracking-tighter uppercase leading-none ${isActive ? 'text-white' : 'text-on-primary'}`}>
                    {isActive ? 'STOP_SEQUENCE' : 'START_PRECISION'}
                  </span>
                  <span className={`font-label text-[9px] md:text-xs tracking-[0.4em] opacity-70 uppercase font-bold ${isActive ? 'text-white' : 'text-on-primary'}`}>
                    {isActive ? `${starterBarCount} Bar Count-In` : 'Execute Current Sequence'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative corner screws */}
      <ScrewDot className="top-20 left-4" />
      <ScrewDot className="top-20 right-4" />
      <ScrewDot className="bottom-24 left-4" />
      <ScrewDot className="bottom-24 right-4" />

      {/* ── Bottom Nav ── */}
      <nav className="bg-surface-container-low border-t-4 border-background z-50 h-20 flex justify-around items-center px-4 pb-2 flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => onExitTo?.('Metronome') ?? onExit()}
          className="flex flex-col items-center justify-center text-outline px-4 py-1 hover:bg-surface-container-high hover:text-primary transition-all rounded-sm"
        >
          <span className="material-symbols-outlined mb-1">vibration</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest">RACK</span>
        </button>
        <div className="flex flex-col items-center justify-center bg-surface-container-high text-primary rounded-sm border-b-2 border-primary shadow-[0_0_15px_rgba(255,215,155,0.3)] px-4 py-1">
          <span className="material-symbols-outlined mb-1">timer</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest">METRO</span>
        </div>
        <button
          onClick={() => onExitTo?.('Library') ?? onExit()}
          className="flex flex-col items-center justify-center text-outline px-4 py-1 hover:bg-surface-container-high hover:text-primary transition-all rounded-sm"
        >
          <span className="material-symbols-outlined mb-1">library_music</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest">LIB</span>
        </button>
        <button
          onClick={() => onExitTo?.('Settings') ?? onExit()}
          className="flex flex-col items-center justify-center text-outline px-4 py-1 hover:bg-surface-container-high hover:text-primary transition-all rounded-sm"
        >
          <span className="material-symbols-outlined mb-1">settings</span>
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest">SET</span>
        </button>
      </nav>
    </div>
  )
}
