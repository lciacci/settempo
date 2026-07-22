import { useState, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { exportAllData, importData } from '../lib/backup'
import { describeError } from '../lib/notify'

async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([
    ['Title', 'BPM', 'Time Signature', 'Notes'],
    ['Example Song', 120, '4/4', 'Capo 2, key of G'],
    ['Another Song', 95, '3/4', ''],
    ['Slow Ballad', 72, '4/4', 'Full band intro'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Songs')
  XLSX.writeFile(wb, 'settempo-import-template.xlsx')
}

function downloadCSVTemplate() {
  const csv = 'Title,BPM,Time Signature,Notes\nExample Song,120,4/4,Capo 2\nAnother Song,95,3/4,\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'settempo-import-template.csv'
  a.click()
}

// Track is 48px wide, knob 20px, inset 2px — so the travel is 48-20-2 = 26px.
// The previous `translate-x-6` (24px) left the knob 2px from the left edge
// when off but 4px from the right when on, which read as misaligned.
function ToggleSwitch({ active, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => onChange(!active)}
      className={`relative w-12 h-6 rounded-sm transition-colors duration-200 border ${
        active ? 'bg-primary-container border-primary/50' : 'bg-surface-container-lowest border-outline-variant/30'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0 w-5 h-5 rounded-sm transition-transform duration-200 ${
          active
            // Dark knob on the amber track. Previously both were amber
            // (bg-primary on bg-primary-container), so the knob dissolved
            // into its own track and "on" was hard to read at a glance.
            ? 'translate-x-[26px] bg-on-primary shadow-[0_0_8px_rgba(255,179,0,0.6)]'
            : 'translate-x-0.5 bg-surface-container-high'
        }`}
      />
    </button>
  )
}

function ScrewDot({ className = '' }) {
  return <div className={`screw-head ${className}`} />
}

export default function Settings({ currentArtistId }) {
  const [status, setStatus] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMode, setImportMode] = useState('add')
  const [showRestore, setShowRestore] = useState(false)
  const fileRef = useRef()

  const { performance, setPerformance } = useAppStore()
  // The log now lives in the store and records the whole app, not just this
  // screen. addLog stays as the local spelling so call sites read unchanged.
  const log = useAppStore((s) => s.systemLog)
  const addLog = useAppStore((s) => s.notify)

  const handleExport = async (artistOnly) => {
    addLog('EXPORT INITIATED...')
    setStatus('exporting')
    try {
      const data = await exportAllData(artistOnly ? currentArtistId : null)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `settempo-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      addLog('EXPORT COMPLETE · FILE DOWNLOADED', 'ok')
      setStatus('ok')
    } catch (e) {
      addLog(`EXPORT FAILED · ${describeError(e)}`, 'error')
      setStatus('error')
    }
  }

  const handleImportFile = async (file) => {
    setImporting(true)
    setStatus('importing')
    addLog(`IMPORT · MODE=${importMode.toUpperCase()} · ${file.name}`)
    try {
      const text = await file.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('File is not valid JSON')
      }
      const { rows, tables } = await importData(json, importMode)
      addLog(`RESTORE COMPLETE · ${rows} RECORDS ACROSS ${tables} TABLES`, 'ok')
      setStatus('ok')
    } catch (e) {
      addLog(`RESTORE FAILED · ${describeError(e)} · NO CHANGES WRITTEN`, 'error')
      setStatus('error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-4">

      {/* ── Sub-Panel 01: Performance Settings ── */}
      <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low relative">
        {/* Header strip */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
          <ScrewDot />
          <span className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase flex-1">
            Sub-Panel 01 · Performance Config
          </span>
          <ScrewDot />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">

          {/* Left: Toggle Controls */}
          <div className="p-5 space-y-5">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-4">
              CONTROL MATRIX
            </p>

            {/* Auto-Start Metronome */}
            <div className="rack-module rounded-sm bg-surface-container-lowest p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-label text-on-surface text-sm font-semibold leading-tight">Auto-Start Metronome</p>
                <p className="font-body text-outline text-xs mt-0.5">
                  Start tempo automatically when a performance set loads
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <ToggleSwitch
                  label="Auto-start metronome"
                  active={performance.autoStartMetronome}
                  onChange={(v) => {
                    setPerformance({ autoStartMetronome: v })
                    addLog(`AUTO_START_METRO → ${v ? 'ON' : 'OFF'}`)
                  }}
                />
                <span className={`font-mono-digital text-[8px] tracking-widest ${performance.autoStartMetronome ? 'text-primary' : 'text-outline'}`}>
                  {performance.autoStartMetronome ? 'ACTIVE' : 'BYPASS'}
                </span>
              </div>
            </div>

            {/* After Starter: Advance */}
            <div className="rack-module rounded-sm bg-surface-container-lowest p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-label text-on-surface text-sm font-semibold leading-tight">Auto-Advance After Intro</p>
                <p className="font-body text-outline text-xs mt-0.5">
                  Automatically advance to next song when the song starter finishes
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <ToggleSwitch
                  label="Auto-advance after intro"
                  active={performance.afterStarterFinish === 'advance'}
                  onChange={(v) => {
                    setPerformance({ afterStarterFinish: v ? 'advance' : 'stop' })
                    addLog(`AFTER_STARTER → ${v ? 'ADVANCE' : 'STOP'}`)
                  }}
                />
                <span className={`font-mono-digital text-[8px] tracking-widest ${performance.afterStarterFinish === 'advance' ? 'text-primary' : 'text-outline'}`}>
                  {performance.afterStarterFinish === 'advance' ? 'ACTIVE' : 'BYPASS'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: System Log */}
          <div className="p-5 flex flex-col">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-3">
              SYSTEM LOG
            </p>
            <div className="rack-module rounded-sm bg-surface-container-lowest flex-1 min-h-[160px] relative overflow-hidden">
              <div className="scanline-overlay absolute inset-0 pointer-events-none z-10" />
              {/* Newest-first, matching reading order everywhere else in the
                  app. The store keeps the log in this order, so there is no
                  reversal here — the previous bottom-anchored rendering was a
                  flex-col-reverse on a single child, which only pinned the
                  block to the bottom without ordering anything. */}
              <div className="p-3 h-full overflow-y-auto">
                <div className="space-y-0.5">
                  {log.map((entry, i) => (
                    <p
                      key={entry.id}
                      className={`font-mono text-[10px] leading-relaxed system-log-glow ${
                        entry.level === 'error'
                          ? 'text-error'
                          : i === 0
                            ? 'text-secondary'
                            : 'text-outline/60'
                      }`}
                    >
                      &gt; {entry.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Panel 02: Hardware Manifest / Data ── */}
      <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low relative">
        {/* Header strip */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
          <ScrewDot />
          <span className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase flex-1">
            Sub-Panel 02 · Hardware Manifest
          </span>
          <ScrewDot />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">

          {/* Templates — the primary path. Bulk song import is what people
              actually come here to do; the download and the import that
              consumes it now sit next to each other instead of on separate
              screens with no link between them. */}
          <div className="p-5 space-y-3">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-primary uppercase mb-4">
              BULK SONG IMPORT
            </p>
            <p className="font-body text-outline text-xs">
              Download a spreadsheet template, fill in your songs, then load it from the
              Library — <span className="text-on-surface">Songs → Import</span>.
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => { downloadTemplate(); addLog('TEMPLATE DOWNLOADED · XLSX') }}
                className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all"
              >
                XLSX Template
              </button>
              <button
                onClick={() => { downloadCSVTemplate(); addLog('TEMPLATE DOWNLOADED · CSV') }}
                className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all"
              >
                CSV Template
              </button>
            </div>
          </div>

          {/* Backup — secondary. Export is a safety net, not a daily task. */}
          <div className="p-5 space-y-3">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-4">
              BACKUP · SNAPSHOT
            </p>
            <p className="font-body text-outline text-xs">
              Download the whole library as a JSON snapshot for safe-keeping.
            </p>
            <div className="space-y-2 pt-1">
              {currentArtistId && (
                <button
                  onClick={() => handleExport(true)}
                  className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all"
                >
                  Export Current Artist
                </button>
              )}
              <button
                onClick={() => handleExport(false)}
                className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all"
              >
                Export All Data
              </button>

              {/* Restore is buried, not removed. Burying it keeps Export from
                  being a dead end — a backup you cannot restore is not a
                  backup — while keeping a destructive operation off the
                  primary surface. */}
              <button
                onClick={() => setShowRestore((v) => !v)}
                className="w-full pt-2 font-mono-digital text-[9px] uppercase tracking-widest text-outline/60 hover:text-outline transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">
                  {showRestore ? 'expand_less' : 'expand_more'}
                </span>
                Advanced · Restore
              </button>

              {showRestore && (
                <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                  <p className="font-body text-outline text-xs">
                    Restore from a snapshot. <span className="text-on-surface">Merge</span> adds
                    records; <span className="text-error">Replace</span> deletes the current
                    library first.
                  </p>
                  <div className="flex gap-1">
                    {['add', 'replace'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setImportMode(mode)}
                        className={`flex-1 py-2 text-[10px] font-mono-digital uppercase tracking-widest rounded-sm transition-all border ${
                          importMode === mode
                            ? mode === 'replace'
                              ? 'bg-error-container/30 text-error border-error/40'
                              : 'bg-primary-container text-primary border-primary/40'
                            : 'bg-surface-container-lowest text-outline border-outline-variant/20 hover:border-outline/40'
                        }`}
                      >
                        {mode === 'add' ? 'Merge' : 'Replace'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => fileRef.current.click()}
                    disabled={importing}
                    className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest active:scale-95 transition-all disabled:opacity-40"
                  >
                    {importing ? 'Loading…' : 'Select Snapshot…'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) handleImportFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status bar */}
        {status && (
          <div className={`px-4 py-2 border-t border-outline-variant/20 flex items-center gap-2 ${
            status === 'error' ? 'bg-error-container/20' : 'bg-surface-container-lowest'
          }`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              status === 'ok' ? 'glow-bulb bg-primary' :
              status === 'error' ? 'bg-error' :
              'bg-secondary animate-pulse'
            }`} />
            <span className={`font-mono-digital text-[9px] tracking-widest uppercase ${
              status === 'error' ? 'text-error' : 'text-outline'
            }`}>
              {status === 'ok' && 'OPERATION COMPLETE'}
              {status === 'error' && 'OPERATION FAILED — CHECK LOG'}
              {status === 'exporting' && 'EXPORTING DATA...'}
              {status === 'importing' && 'RESTORING DATA...'}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-3 py-2 opacity-30">
        <ScrewDot />
        <span className="font-mono-digital text-[8px] tracking-[0.4em] text-outline uppercase">
          SETTEMPO · ANALOG PRECISION · v2
        </span>
        <ScrewDot />
      </div>
    </div>
  )
}
