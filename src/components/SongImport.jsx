import { useState, useCallback } from 'react'
import { db } from '../db/db'

const APP_FIELDS = ['title', 'bpm', 'timeSig', 'notes']
const APP_FIELD_LABELS = { title: 'Title', bpm: 'BPM', timeSig: 'Time Sig', notes: 'Notes' }

function guessMapping(headers) {
  const map = {}
  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    if (['title', 'song', 'name', 'song title'].includes(lower)) map[h] = 'title'
    else if (['bpm', 'tempo', 'beats per minute'].includes(lower)) map[h] = 'bpm'
    else if (['time sig', 'time signature', 'timesig', 'time_sig', 'meter'].includes(lower)) map[h] = 'timeSig'
    else if (['notes', 'note', 'comments', 'key', 'capo'].includes(lower)) map[h] = 'notes'
    else map[h] = ''
  }
  return map
}

function parseTimeSig(val) {
  if (!val) return { n: 4, d: 4 }
  const str = String(val).trim()
  const match = str.match(/^(\d+)\s*[/\\]\s*(\d+)$/)
  if (match) return { n: Number(match[1]), d: Number(match[2]) }
  return { n: 4, d: 4 }
}

function validateRow(raw, mapping) {
  const errors = []
  const title = raw[Object.keys(mapping).find((k) => mapping[k] === 'title')] ?? ''
  const bpmRaw = raw[Object.keys(mapping).find((k) => mapping[k] === 'bpm')]
  const bpm = Number(bpmRaw)

  if (!String(title).trim()) errors.push('Missing title')
  if (bpmRaw !== undefined && bpmRaw !== '' && (isNaN(bpm) || bpm < 1 || bpm > 300))
    errors.push(`Invalid BPM: ${bpmRaw}`)

  return errors
}

function buildSong(raw, mapping) {
  const get = (field) => {
    const col = Object.keys(mapping).find((k) => mapping[k] === field)
    return col ? raw[col] : undefined
  }
  const { n, d } = parseTimeSig(get('timeSig'))
  return {
    title: String(get('title') ?? '').trim(),
    bpm: Math.min(300, Math.max(1, Number(get('bpm')) || 120)),
    timeSigN: n, timeSigD: d,
    notes: String(get('notes') ?? '').trim(),
  }
}

const STEPS = ['upload', 'map', 'preview', 'done']
const STEP_LABELS = { upload: '01_LOAD', map: '02_MAP', preview: '03_VERIFY', done: '04_DONE' }

export default function SongImport({ artistId, onClose, onDone }) {
  const [step, setStep] = useState('upload')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [importMode, setImportMode] = useState('add')
  const [importing, setImporting] = useState(false)
  const [importCount, setImportCount] = useState(0)

  const handleFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!data.length) return
      const hdrs = Object.keys(data[0])
      setHeaders(hdrs)
      setRows(data)
      setMapping(guessMapping(hdrs))
      setStep('map')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const preview = rows.map((r) => ({ ...buildSong(r, mapping), errors: validateRow(r, mapping) }))
  const validRows = preview.filter((r) => r.errors.length === 0 && r.title)
  const errorRows = preview.filter((r) => r.errors.length > 0 || !r.title)

  const runImport = async () => {
    setImporting(true)
    try {
      if (importMode === 'replace') {
        const now = Date.now()
        await db.songs.where('artistId').equals(artistId).modify({ deletedAt: now, updatedAt: now })
      }
      for (const song of validRows) {
        if (importMode === 'add') {
          const existing = await db.songs
            .where('artistId').equals(artistId)
            .filter((s) => s.title.toLowerCase() === song.title.toLowerCase())
            .first()
          if (existing) {
            await db.songs.update(existing.id, { ...song, updatedAt: Date.now() })
            continue
          }
        }
        await db.songs.add({ ...song, artistId, createdAt: Date.now(), updatedAt: Date.now() })
      }
      setImportCount(validRows.length)
      setStep('done')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Title', 'BPM', 'Time Signature', 'Notes'],
      ['Example Song', 120, '4/4', 'Capo 2'],
      ['Another Song', 95, '3/4', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Songs')
    XLSX.writeFile(wb, 'settempo-import-template.xlsx')
  }

  const currentStepIndex = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden">

        {/* Corner screws */}
        <div className="absolute top-3 left-3"><div className="screw-head" /></div>
        <div className="absolute top-3 right-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 left-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 right-3"><div className="screw-head" /></div>

        {/* Header */}
        <div className="border-b border-outline-variant/20 px-8 pt-8 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.5em]">Data Ingest Protocol</p>
              <h3 className="font-headline font-black text-primary uppercase tracking-tight text-2xl">Import Songs</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-outline hover:text-primary transition-colors rounded mt-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all ${
                  i <= currentStepIndex ? 'bg-primary-container' : 'bg-surface-container-highest'
                }`}
              />
            ))}
          </div>
          <div className="flex mt-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <p className={`font-mono-digital text-[8px] uppercase tracking-widest ${
                  i === currentStepIndex ? 'text-primary' : i < currentStepIndex ? 'text-outline' : 'text-outline/40'
                }`}>{STEP_LABELS[s]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('song-import-file').click()}
                className="border border-dashed border-outline-variant/40 hover:border-primary/50 rounded-sm p-12 text-center transition-colors cursor-pointer group"
              >
                <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary transition-colors mb-3 block">upload_file</span>
                <p className="font-headline font-black text-on-surface uppercase tracking-wide text-sm mb-1">Drop file here</p>
                <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">CSV or XLSX · click to browse</p>
                <input
                  id="song-import-file" type="file" accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full py-2.5 border border-outline-variant/20 hover:border-outline-variant/50 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download Template (XLSX)
              </button>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'map' && (
            <div className="space-y-5">
              <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">
                Map spreadsheet columns to SetTempo fields.
              </p>

              <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/20 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20">
                      <th className="text-left py-2 px-3 font-mono-digital text-[9px] text-outline uppercase tracking-widest">Your Column</th>
                      <th className="text-left py-2 px-3 font-mono-digital text-[9px] text-outline uppercase tracking-widest">Maps To</th>
                      <th className="text-left py-2 px-3 font-mono-digital text-[9px] text-outline uppercase tracking-widest">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => (
                      <tr key={h} className="border-t border-outline-variant/10 hover:bg-surface-container/50">
                        <td className="py-2 px-3 text-primary font-mono-digital text-xs">{h}</td>
                        <td className="py-2 px-3">
                          <select
                            value={mapping[h] || ''}
                            onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                            className="bg-surface-container-high border border-outline-variant/30 text-primary rounded-sm px-2 py-1 font-mono-digital text-[10px] outline-none focus:border-primary/60 uppercase tracking-wider"
                          >
                            <option value="" className="bg-surface-container-highest">— skip —</option>
                            {APP_FIELDS.map((f) => (
                              <option key={f} value={f} className="bg-surface-container-highest">{APP_FIELD_LABELS[f]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-outline font-mono-digital text-[10px] truncate max-w-32">
                          {String(rows[0]?.[h] ?? '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import mode */}
              <div className="flex gap-2">
                {['add', 'replace'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    className={`flex-1 py-2.5 rounded-sm font-mono-digital text-[10px] uppercase tracking-widest transition-all border ${
                      importMode === mode
                        ? 'bg-primary-container text-on-primary border-primary-container'
                        : 'bg-surface-container-high border-outline-variant/20 text-outline hover:text-on-surface'
                    }`}
                  >
                    {mode === 'add' ? 'Add to Library' : 'Replace Library'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep('preview')}
                disabled={!Object.values(mapping).includes('title')}
                className="w-full py-3 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all disabled:opacity-40"
              >
                Preview →
              </button>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="font-mono-digital text-[10px] text-secondary uppercase tracking-widest">{validRows.length} Valid</span>
                </div>
                {errorRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-error" />
                    <span className="font-mono-digital text-[10px] text-error uppercase tracking-widest">{errorRows.length} Skipped</span>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/20 max-h-64 overflow-y-auto">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-outline-variant/10 last:border-0 ${
                      row.errors.length ? 'bg-error-container/10' : ''
                    }`}
                  >
                    <span className={`font-mono-digital text-[10px] w-3 ${row.errors.length ? 'text-error' : 'text-secondary'}`}>
                      {row.errors.length ? '✗' : '✓'}
                    </span>
                    <span className="text-on-surface font-mono-digital text-xs flex-1 truncate">{row.title || '(no title)'}</span>
                    <span className="text-outline font-mono-digital text-[10px]">{row.bpm}</span>
                    <span className="text-outline font-mono-digital text-[10px]">{row.timeSigN}/{row.timeSigD}</span>
                    {row.errors.length > 0 && <span className="text-error font-mono-digital text-[9px]">{row.errors[0]}</span>}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('map')}
                  className="px-4 py-2.5 border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || validRows.length === 0}
                  className="flex-1 py-3 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {importing ? 'Writing…' : `Import ${validRows.length} Songs`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center py-10 space-y-6">
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em] mb-1">Ingest Complete</p>
                <p className="font-headline font-black text-primary text-3xl uppercase">{importCount} Songs</p>
                <p className="font-mono-digital text-[10px] text-outline mt-1 uppercase tracking-widest">written to library</p>
              </div>
              <button
                onClick={() => { onDone?.(); onClose() }}
                className="px-8 py-3 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
