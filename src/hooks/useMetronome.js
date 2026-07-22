import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { describeError, notify } from '../lib/notify'

const semitoneRatio = (n) => Math.pow(2, n / 12)

function scheduleBeep(ctx, time, isAccent, pitch, volume) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = (isAccent ? 1000 : 800) * semitoneRatio(pitch)
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume * (isAccent ? 1.0 : 0.7), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(time); osc.stop(time + 0.05)
}

function scheduleWoodblock(ctx, time, isAccent, pitch, volume) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = (isAccent ? 900 : 700) * semitoneRatio(pitch)
  osc.type = 'triangle'
  gain.gain.setValueAtTime(volume * (isAccent ? 1.0 : 0.75), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(time); osc.stop(time + 0.04)
}

function scheduleCowbell(ctx, time, isAccent, pitch, volume) {
  const freqs = [isAccent ? 562 : 440, isAccent ? 845 : 660].map((f) => f * semitoneRatio(pitch))
  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(volume * (isAccent ? 1.0 : 0.7), time)
  masterGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
  masterGain.connect(ctx.destination)
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator()
    osc.type = 'square'; osc.frequency.value = freq
    osc.connect(masterGain); osc.start(time); osc.stop(time + 0.3)
  })
}

function scheduleClick(ctx, time, isAccent, sound, pitch, volume) {
  if (sound === 'beep') scheduleBeep(ctx, time, isAccent, pitch, volume)
  else if (sound === 'woodblock') scheduleWoodblock(ctx, time, isAccent, pitch, volume)
  else if (sound === 'cowbell') scheduleCowbell(ctx, time, isAccent, pitch, volume)
}

const SCHEDULE_AHEAD = 0.1
const LOOK_AHEAD = 25

// ── Shared AudioContext ───────────────────────────────────────────────────
// One context for the whole app, not one per hook instance. Metronome.jsx and
// PerformanceMode.jsx both call useMetronome(), and a per-instance context
// meant navigating between them allocated a second one. Browsers cap
// concurrent AudioContexts (historically ~4 on iOS) and fail to start new
// ones past the limit — silently, which is exactly the reported symptom.
let sharedCtx = null

function getContext() {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const Ctor = window.AudioContext || window.webkitAudioContext
    sharedCtx = new Ctor()
  }
  return sharedCtx
}

export function useMetronome() {
  const { metronome, setMetronome } = useAppStore()
  const ctxRef = useRef(null)
  const timerRef = useRef(null)
  const nextBeatTimeRef = useRef(0)
  const beatRef = useRef(0)
  const barRef = useRef(0)

  // Song Starter
  const starterBarsRef = useRef(0)
  const onStarterDoneRef = useRef(null)

  // Gap click phase tracking
  const gapPhaseIsClickRef = useRef(true)
  const gapPhaseBarRef = useRef(0)

  // Awaited, unlike before. Browsers create an AudioContext suspended under
  // autoplay policy, and `currentTime` does not advance while suspended — so
  // scheduling against it before the resume settled produced beat times that
  // were already stale by the time audio actually started. The scheduler then
  // ran out of work and the metronome stayed silent.
  const ensureContext = useCallback(async () => {
    const ctx = getContext()
    ctxRef.current = ctx
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // Resume rejects when not called from a user gesture. Fall through:
        // the diagnostic below records the state so a silent metronome can be
        // told apart from a muted one.
      }
    }
    return ctx
  }, [])

  const stopInternal = useCallback(() => {
    clearTimeout(timerRef.current)
    beatRef.current = 0
    barRef.current = 0
    gapPhaseIsClickRef.current = true
    gapPhaseBarRef.current = 0
    starterBarsRef.current = 0
  }, [])

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return

    const {
      bpm, timeSignatureNumerator, sound, pitch, volume, muted,
      gapClickEnabled, gapClickBars, gapSilentBars,
    } = useAppStore.getState().metronome

    const spb = 60.0 / bpm

    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const isAccent = beatRef.current === 0
      const gapMuted = gapClickEnabled && !gapPhaseIsClickRef.current
      const currentBeatForStore = beatRef.current

      if (!muted && !gapMuted) {
        scheduleClick(ctx, nextBeatTimeRef.current, isAccent, sound, pitch, volume)
      }

      nextBeatTimeRef.current += spb
      beatRef.current = (beatRef.current + 1) % timeSignatureNumerator

      if (beatRef.current === 0) {
        barRef.current += 1

        // Gap click phase management
        if (gapClickEnabled) {
          gapPhaseBarRef.current += 1
          const limit = gapPhaseIsClickRef.current ? gapClickBars : gapSilentBars
          if (gapPhaseBarRef.current >= limit) {
            gapPhaseIsClickRef.current = !gapPhaseIsClickRef.current
            gapPhaseBarRef.current = 0
            setMetronome({ gapPhaseIsClick: gapPhaseIsClickRef.current })
          }
        }

        // Song Starter completion check
        if (starterBarsRef.current > 0 && barRef.current >= starterBarsRef.current) {
          stopInternal()
          setMetronome({ isPlaying: false, currentBeat: 0, currentBar: 0, starterDone: true })
          onStarterDoneRef.current?.()
          return
        }
      }

      setMetronome({ currentBeat: currentBeatForStore, currentBar: barRef.current })
    }

    timerRef.current = setTimeout(scheduler, LOOK_AHEAD)
  }, [setMetronome, stopInternal])

  const start = useCallback(async (opts = {}) => {
    let ctx
    try {
      ctx = await ensureContext()
    } catch (err) {
      // Every caller fires this without awaiting, so a rejection here would
      // be an unhandled promise — silence, which is the failure mode this
      // whole layer exists to eliminate.
      notify(`AUDIO UNAVAILABLE · ${describeError(err)}`, 'error')
      return
    }
    stopInternal()
    if (opts.starterBars) {
      starterBarsRef.current = opts.starterBars
      onStarterDoneRef.current = opts.onDone ?? null
    }

    // Read currentTime only after the resume has settled.
    nextBeatTimeRef.current = ctx.currentTime + (ctx.state !== 'running' ? 0.3 : 0.05)
    setMetronome({ isPlaying: true, currentBeat: 0, currentBar: 0, starterDone: false, gapPhaseIsClick: true })
    timerRef.current = setTimeout(scheduler, LOOK_AHEAD)

    // Diagnostic, written to the system log only — never a toast. Silence is
    // often correct here (muted, zero volume, gap-click rest phase), so this
    // records *why* it would be silent rather than reporting a fault. A
    // healthy start logs nothing at all, so the log stays readable.
    const m = useAppStore.getState().metronome
    const reasons = []
    if (ctx.state !== 'running') reasons.push(`CONTEXT=${ctx.state.toUpperCase()}`)
    if (m.muted) reasons.push('MUTED')
    if (!m.volume) reasons.push('VOLUME=0')
    if (m.gapClickEnabled) reasons.push(`GAP=${m.gapPhaseIsClick ? 'CLICK' : 'SILENT'}`)
    if (reasons.length) {
      useAppStore.getState().logQuietly(`METRONOME START · ${reasons.join(' · ')}`)
    }
  }, [ensureContext, stopInternal, scheduler, setMetronome])

  const stop = useCallback(() => {
    stopInternal()
    setMetronome({ isPlaying: false, currentBeat: 0, currentBar: 0 })
  }, [stopInternal, setMetronome])

  const toggle = useCallback(() => {
    if (useAppStore.getState().metronome.isPlaying) stop()
    else start()
  }, [start, stop])

  // Restart on BPM/time sig change while playing
  useEffect(() => {
    if (metronome.isPlaying) { stop(); start() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metronome.bpm, metronome.timeSignatureNumerator, metronome.timeSignatureDenominator])

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      // Deliberately does NOT close the context. It is shared app-wide now,
      // so closing it here would kill audio for the other component still
      // using it — unmounting Metronome would silence PerformanceMode.
    }
  }, [])

  return { start, stop, toggle }
}
