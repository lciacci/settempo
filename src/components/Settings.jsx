import { useState, useRef } from 'react'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'

async function exportAllData(artistId) {
  const tables = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']
  const data = {}

  for (const table of tables) {
    if (artistId && table === 'artists') {
      data[table] = [await db.artists.get(artistId)].filter(Boolean)
    } else if (artistId && table === 'songs') {
      data[table] = await db.songs.where('artistId').equals(artistId).toArray()
    } else if (artistId && table === 'sets') {
      data[table] = await db.sets.where('artistId').equals(artistId).toArray()
    } else if (artistId && table === 'shows') {
      data[table] = await db.shows.where('artistId').equals(artistId).toArray()
    } else {
      data[table] = await db[table].toArray()
    }
  }

  if (artistId) {
    const setIds = new Set(data.sets.map((s) => s.id))
    const showIds = new Set(data.shows.map((s) => s.id))

    data.setEntries = (await db.setEntries.toArray()).filter((e) => setIds.has(e.setId))
    data.setlists = (await db.setlists.toArray()).filter((sl) => showIds.has(sl.showId))
    const setlistIds = new Set(data.setlists.map((sl) => sl.id))
    data.setlistSets = (await db.setlistSets.toArray()).filter((ss) => setlistIds.has(ss.setlistId))
  }

  return data
}

async function importData(json, mode) {
  const tables = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']

  if (mode === 'replace') {
    for (const table of tables) await db[table].clear()
  }

  const idMap = {}

  for (const table of tables) {
    const rows = json[table] ?? []
    for (const row of rows) {
      const { id: oldId, ...rest } = row
      if (rest.artistId && idMap.artists?.[rest.artistId]) rest.artistId = idMap.artists[rest.artistId]
      if (rest.setId && idMap.sets?.[rest.setId]) rest.setId = idMap.sets[rest.setId]
      if (rest.songId && idMap.songs?.[rest.songId]) rest.songId = idMap.songs[rest.songId]
      if (rest.showId && idMap.shows?.[rest.showId]) rest.showId = idMap.shows[rest.showId]
      if (rest.setlistId && idMap.setlists?.[rest.setlistId]) rest.setlistId = idMap.setlists[rest.setlistId]

      const newId = await db[table].add(rest)
      if (!idMap[table]) idMap[table] = {}
      idMap[table][oldId] = newId
    }
  }
}

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

function ToggleSwitch({ active, onChange }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`relative w-12 h-6 rounded-sm transition-colors duration-200 border ${
        active ? 'bg-primary-container border-primary/50' : 'bg-surface-container-lowest border-outline-variant/30'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-sm transition-transform duration-200 ${
          active
            ? 'translate-x-6 bg-primary shadow-[0_0_8px_rgba(255,179,0,0.6)]'
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
  const [log, setLog] = useState(['> SYSTEM READY', '> SETTEMPO v2 · ANALOG PRECISION'])
  const fileRef = useRef()

  const { performance, setPerformance } = useAppStore()

  const addLog = (msg) => setLog((prev) => [...prev.slice(-19), `> ${msg}`])

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
      addLog('EXPORT COMPLETE · FILE DOWNLOADED')
      setStatus('ok')
    } catch (e) {
      addLog(`EXPORT ERROR: ${e.message}`)
      setStatus('error')
    }
  }

  const handleImportFile = async (file) => {
    setImporting(true)
    setStatus('importing')
    addLog(`IMPORT · MODE=${importMode.toUpperCase()} · ${file.name}`)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await importData(json, importMode)
      addLog(`IMPORT COMPLETE · MODE=${importMode.toUpperCase()}`)
      setStatus('ok')
    } catch (e) {
      addLog(`IMPORT ERROR: ${e.message}`)
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
              <div className="p-3 h-full overflow-y-auto flex flex-col-reverse">
                <div className="space-y-0.5">
                  {log.map((line, i) => (
                    <p
                      key={i}
                      className={`font-mono text-[10px] leading-relaxed system-log-glow ${
                        i === log.length - 1 ? 'text-secondary' : 'text-outline/60'
                      }`}
                    >
                      {line}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">

          {/* Export */}
          <div className="p-5 space-y-3">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-4">
              EXPORT · BACKUP
            </p>
            <p className="font-body text-outline text-xs">
              Download your library as a JSON snapshot for safe-keeping or device migration.
            </p>
            <div className="space-y-2 pt-1">
              {currentArtistId && (
                <button
                  onClick={() => handleExport(true)}
                  className="w-full py-2.5 bg-primary text-on-primary font-label font-bold text-xs uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
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
            </div>
          </div>

          {/* Import */}
          <div className="p-5 space-y-3">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-4">
              IMPORT · RESTORE
            </p>
            <p className="font-body text-outline text-xs">
              Restore from a JSON backup. Merge adds records; Replace overwrites everything.
            </p>

            {/* Mode selector */}
            <div className="flex gap-1 pt-1">
              {['add', 'replace'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`flex-1 py-2 text-[10px] font-mono-digital uppercase tracking-widest rounded-sm transition-all border ${
                    importMode === mode
                      ? 'bg-primary-container text-primary border-primary/40'
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
              {importing ? 'Loading…' : 'Select JSON File…'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleImportFile(e.target.files[0])}
            />
          </div>

          {/* Templates */}
          <div className="p-5 space-y-3">
            <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-4">
              TEMPLATES · BULK IMPORT
            </p>
            <p className="font-body text-outline text-xs">
              Download a spreadsheet template to prepare songs for bulk import via the Library.
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
              {status === 'importing' && 'IMPORTING DATA...'}
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
