import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

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

  const ensureContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
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

  const start = useCallback((opts = {}) => {
    const ctx = ensureContext()
    stopInternal()
    if (opts.starterBars) {
      starterBarsRef.current = opts.starterBars
      onStarterDoneRef.current = opts.onDone ?? null
    }
    nextBeatTimeRef.current = ctx.currentTime + (ctx.state !== 'running' ? 0.3 : 0.05)
    setMetronome({ isPlaying: true, currentBeat: 0, currentBar: 0, starterDone: false, gapPhaseIsClick: true })
    timerRef.current = setTimeout(scheduler, LOOK_AHEAD)
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
      ctxRef.current?.close()
    }
  }, [])

  return { start, stop, toggle }
}
