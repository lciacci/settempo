import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, softDelete } from '../db/db'
import SongPicker from './SongPicker'
import OverrideModal from './OverrideModal'

// ── Entry Editor Modal ──────────────────────────────────────────────────────

function EntryEditor({ entry, song, onSave, onClose }) {
  const [bpm, setBpm] = useState(entry.bpmOverride ?? '')
  const [timeSigN, setTimeSigN] = useState(entry.timeSigNOverride ?? '')
  const [timeSigD, setTimeSigD] = useState(entry.timeSigDOverride ?? '')
  const [notes, setNotes] = useState(entry.notesOverride ?? '')
  const [pendingField, setPendingField] = useState(null)
  const [pendingValue, setPendingValue] = useState(null)

  const handleSave = () => {
    onSave({
      bpmOverride: bpm !== '' ? Number(bpm) : null,
      timeSigNOverride: timeSigN !== '' ? Number(timeSigN) : null,
      timeSigDOverride: timeSigD !== '' ? Number(timeSigD) : null,
      notesOverride: notes || null,
    })
  }

  const checkGlobal = (field, value, currentSongValue) => {
    if (value !== '' && Number(value) !== currentSongValue) {
      setPendingField(field)
      setPendingValue(value)
    }
  }

  const applyLocal = () => setPendingField(null)

  const applyGlobal = async () => {
    const updates = {}
    if (pendingField === 'bpm') updates.bpm = Number(pendingValue)
    if (pendingField === 'timeSigN') updates.timeSigN = Number(pendingValue)
    if (pendingField === 'timeSigD') updates.timeSigD = Number(pendingValue)
    await db.songs.update(song.id, { ...updates, updatedAt: Date.now() })
    if (pendingField === 'bpm') setBpm('')
    if (pendingField === 'timeSigN') setTimeSigN('')
    if (pendingField === 'timeSigD') setTimeSigD('')
    setPendingField(null)
  }

  const inputClass = (overridden) =>
    `w-full bg-surface-container border border-outline-variant/20 rounded-sm px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono-digital transition-colors ${overridden ? 'text-primary' : 'text-on-surface'}`

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg w-full max-w-sm p-5 space-y-5 rack-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase mb-1">ENTRY OVERRIDE</p>
              <h3 className="font-headline font-bold text-on-surface truncate uppercase">{song?.title ?? '(deleted)'}</h3>
            </div>
            <button onClick={onClose} className="text-outline hover:text-primary transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="font-mono-digital text-[9px] text-outline/60 uppercase tracking-widest">
            Amber = override active. Leave blank to use song default.
          </p>

          <div className="space-y-4">
            <div>
              <label className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mb-2 block">BPM Override</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={300}
                  placeholder={song?.bpm ?? 120}
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  onBlur={() => bpm && checkGlobal('bpm', bpm, song?.bpm)}
                  className={inputClass(bpm !== '')}
                />
                {bpm !== '' && (
                  <button onClick={() => setBpm('')} className="text-outline hover:text-primary text-xs font-mono-digital uppercase">CLR</button>
                )}
              </div>
            </div>

            <div>
              <label className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mb-2 block">Time Sig Override</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={16}
                  placeholder={song?.timeSigN ?? 4}
                  value={timeSigN}
                  onChange={(e) => setTimeSigN(e.target.value)}
                  className={`w-16 text-center ${inputClass(timeSigN !== '')}`}
                />
                <span className="text-outline font-mono-digital">/</span>
                <select
                  value={timeSigD || (song?.timeSigD ?? 4)}
                  onChange={(e) => setTimeSigD(e.target.value)}
                  className="w-16 bg-surface-container border border-outline-variant/20 text-on-surface rounded-sm px-2 py-2 outline-none text-sm font-mono-digital"
                >
                  {[2, 4, 8, 16].map((d) => <option key={d}>{d}</option>)}
                </select>
                {(timeSigN !== '' || timeSigD !== '') && (
                  <button onClick={() => { setTimeSigN(''); setTimeSigD('') }} className="text-outline hover:text-primary text-xs font-mono-digital uppercase">CLR</button>
                )}
              </div>
            </div>

            <div>
              <label className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mb-2 block">Notes Override</label>
              <textarea
                placeholder={song?.notes || 'No notes'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`resize-none ${inputClass(!!notes)}`}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-container-high text-on-surface font-headline font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-surface-container-highest transition-colors border border-outline-variant/20"
            >Cancel</button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-primary text-on-primary font-headline font-bold text-xs uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
            >Save</button>
          </div>
        </div>
      </div>

      {pendingField && (
        <OverrideModal
          field={pendingField}
          localValue={pendingValue}
          onLocal={applyLocal}
          onGlobal={applyGlobal}
          onCancel={() => setPendingField(null)}
        />
      )}
    </>
  )
}

// ── Sortable Entry Row ──────────────────────────────────────────────────────

function SortableEntry({ entry, song, index, isFirst, onEdit, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  const bpm = entry.bpmOverride ?? song?.bpm ?? '?'
  const hasOverride = entry.bpmOverride || entry.timeSigNOverride

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative p-1 rounded-sm flex items-center gap-4 cursor-pointer transition-all ${
        isFirst
          ? 'bg-surface-container-high border-l-4 border-primary shadow-lg'
          : 'bg-surface-container-low border-l-4 border-transparent hover:border-surface-bright hover:bg-surface-container-high shadow'
      }`}
      onClick={() => onEdit(entry)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="material-symbols-outlined text-outline-variant group-hover:text-outline transition-colors">drag_indicator</span>
      </div>

      {/* Track number / artwork placeholder */}
      <div className="w-12 h-12 bg-surface-container-lowest flex items-center justify-center rounded flex-shrink-0 border border-surface-container">
        <span className={`material-symbols-outlined text-xl ${isFirst ? 'text-primary' : 'text-outline/40'}`}>audiotrack</span>
      </div>

      {/* Title + meta */}
      <div className="flex-grow min-w-0">
        <h4 className={`font-headline text-sm font-bold truncate uppercase ${isFirst ? 'text-primary' : 'text-on-surface'}`}>
          {song?.title ?? '(deleted song)'}
        </h4>
        <p className="text-[10px] text-outline truncate uppercase tracking-tighter">
          {String(index + 1).padStart(2, '0')} // {hasOverride ? 'Override Active' : 'Song Default'}
        </p>
      </div>

      {/* BPM + status */}
      <div className="flex items-center gap-4 md:gap-6 pr-2 md:pr-4 flex-shrink-0">
        <div className="text-right">
          <div className={`digital-readout text-lg font-bold ${isFirst ? 'text-primary' : 'text-on-surface'}`}>
            {bpm}.0
          </div>
          <div className="text-[9px] text-outline uppercase tracking-widest">BPM</div>
        </div>
        <div className="hidden md:block h-8 w-px bg-surface-container-highest" />
        <div className="hidden md:flex flex-col items-center gap-1 transition-opacity">
          <div className={`w-3 h-3 rounded-full ${
            isFirst ? 'bg-primary shadow-[0_0_8px_#ffd79b]' : 'bg-surface-container-highest opacity-20 group-hover:opacity-100'
          }`} />
          <span className={`text-[8px] uppercase font-bold ${isFirst ? 'text-primary' : 'text-outline'}`}>
            {isFirst ? 'LIVE' : 'READY'}
          </span>
        </div>
      </div>

      {/* Remove button - hover only */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(entry.id) }}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-outline hover:text-tertiary transition-all p-1"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </li>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SetEditor({ setId, artistId }) {
  const [showPicker, setShowPicker] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  const set = useLiveQuery(() => db.sets.get(setId), [setId])
  const entries = useLiveQuery(
    () => db.setEntries.where('setId').equals(setId).filter(e => !e.deletedAt).sortBy('position'),
    [setId]
  )
  const songs = useLiveQuery(
    () => db.songs.where('artistId').equals(artistId).filter(s => !s.deletedAt).toArray(),
    [artistId]
  )
  const usageCount = useLiveQuery(
    () => db.setlistSets.where('setId').equals(setId).filter(s => !s.deletedAt).count(),
    [setId]
  )

  const songMap = Object.fromEntries((songs ?? []).map((s) => [s.id, s]))
  const entryIds = (entries ?? []).map((e) => e.id)
  const sensors = useSensors(useSensor(PointerSensor))

  const avgBpm = entries && entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + (e.bpmOverride ?? songMap[e.songId]?.bpm ?? 120), 0) / entries.length)
    : 120

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id || !entries) return
    const oldIndex = entries.findIndex((e) => e.id === active.id)
    const newIndex = entries.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(entries, oldIndex, newIndex)
    await Promise.all(reordered.map((entry, i) => db.setEntries.update(entry.id, { position: i, updatedAt: Date.now() })))
  }

  const addSong = async (song) => {
    await db.setEntries.add({
      setId, songId: song.id, position: entries?.length ?? 0,
      bpmOverride: null, timeSigNOverride: null,
      timeSigDOverride: null, notesOverride: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    setShowPicker(false)
  }

  const removeEntry = async (id) => { await softDelete('setEntries', id) }

  const saveEntryOverrides = async (overrides) => {
    await db.setEntries.update(editingEntry.id, { ...overrides, updatedAt: Date.now() })
    setEditingEntry(null)
  }

  const shuffleEntries = async () => {
    if (!entries || entries.length === 0) return
    const shuffled = [...entries].sort(() => Math.random() - 0.5)
    await Promise.all(shuffled.map((entry, i) => db.setEntries.update(entry.id, { position: i, updatedAt: Date.now() })))
  }

  const clearEntries = async () => {
    if (!entries || entries.length === 0) return
    if (!window.confirm('Remove all songs from this set?')) return
    await Promise.all(entries.map((e) => softDelete('setEntries', e.id)))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

      {/* ── Left: Command Module ── */}
      <aside className="md:col-span-4 space-y-6">

        {/* Global Config Panel */}
        <div className="bg-surface-container-low p-6 rounded shadow-lg relative border-l-4 border-primary">
          <div className="absolute top-2 left-2 v-screw" />
          <div className="absolute top-2 right-2 v-screw" />
          <div className="absolute bottom-2 left-2 v-screw" />
          <div className="absolute bottom-2 right-2 v-screw" />

          <div className="mb-6">
            <label className="font-label text-[10px] uppercase tracking-[0.2em] text-outline mb-2 block">Global Configuration</label>
            <h2 className="font-headline text-2xl font-bold text-on-surface tracking-tight uppercase">
              {set?.name ?? '…'}
            </h2>
          </div>

          {/* Master Tempo readout */}
          <div className="bg-surface-container-lowest p-4 rounded-lg mb-6 border border-outline-variant/20">
            <div className="flex justify-between items-center mb-4">
              <label className="font-label text-[10px] uppercase tracking-widest text-primary">Master Tempo</label>
              <div className="w-10 h-5 bg-surface-container-high rounded-full relative flex items-center p-1">
                <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_#ffd79b]" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="digital-readout text-5xl font-bold text-primary leading-none">{avgBpm}.00</div>
              <div className="flex flex-col gap-1">
                <div className="bg-surface-container-high p-1 rounded text-outline text-xs flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">expand_less</span>
                </div>
                <div className="bg-surface-container-high p-1 rounded text-outline text-xs flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative dials */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: 'Crossfade', indicatorClass: 'bg-secondary' },
              { label: 'Quantize',  indicatorClass: 'bg-primary rotate-45 origin-bottom' },
            ].map(({ label, indicatorClass }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-surface-container-lowest to-surface-container-highest flex items-center justify-center border-2 border-surface-container shadow-inner mb-2 relative">
                  <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full ${indicatorClass}`} />
                </div>
                <span className="font-label text-[9px] uppercase tracking-tighter text-outline-variant">{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-4 bg-primary text-on-primary font-headline font-bold uppercase tracking-widest text-sm rounded shadow-[0_4px_15px_rgba(255,215,155,0.2)] hover:brightness-110 active:scale-95 transition-all"
          >
            + Add Track
          </button>
        </div>

        {/* Set Diagnostics */}
        <div className="bg-surface-container-low p-6 rounded shadow-lg relative border-l-4 border-secondary">
          <div className="absolute top-2 right-2 v-screw" />
          <div className="absolute bottom-2 right-2 v-screw" />
          <label className="font-label text-[10px] uppercase tracking-[0.2em] text-outline mb-4 block">Set Diagnostics</label>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-surface-container-high pb-2">
              <span className="text-xs text-on-surface-variant">Duration:</span>
              <span className="text-xs font-bold text-secondary font-mono-digital">
                ~{Math.floor((entries?.length ?? 0) * 3.5)} MIN
              </span>
            </div>
            <div className="flex justify-between border-b border-surface-container-high pb-2">
              <span className="text-xs text-on-surface-variant">Tracks:</span>
              <span className="text-xs font-bold text-secondary font-mono-digital">
                {entries?.length ?? 0} songs
              </span>
            </div>
            <div className="flex justify-between border-b border-surface-container-high pb-2">
              <span className="text-xs text-on-surface-variant">Used in:</span>
              <span className="text-xs font-bold text-secondary font-mono-digital">
                {usageCount ?? 0} setlist{usageCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-on-surface-variant">Avg BPM:</span>
              <span className="text-xs font-bold text-secondary font-mono-digital">{avgBpm}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right: Song Queue ── */}
      <section className="md:col-span-8 space-y-2">
        <div className="flex justify-between items-end px-2 mb-4">
          <div>
            <h3 className="font-headline text-lg font-bold tracking-tight uppercase">ACTIVE_QUEUE</h3>
            <p className="text-[10px] text-outline uppercase tracking-widest">
              {entries?.length ?? 0} tracks · drag to reorder
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shuffleEntries}
              className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase rounded border border-outline-variant/20 hover:text-primary transition-colors"
            >Shuffle</button>
            <button
              onClick={clearEntries}
              className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase rounded border border-outline-variant/20 hover:text-tertiary transition-colors"
            >Clear</button>
          </div>
        </div>

        {/* Song rows */}
        {entries && entries.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {entries.map((entry, i) => (
                  <SortableEntry
                    key={entry.id}
                    entry={entry}
                    song={songMap[entry.songId]}
                    index={i}
                    isFirst={i === 0}
                    onEdit={setEditingEntry}
                    onRemove={removeEntry}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-outline text-sm font-mono-digital uppercase tracking-widest px-2 py-8 text-center">
            No tracks. Add one below.
          </p>
        )}

        {/* Add track button */}
        <button
          onClick={() => setShowPicker(true)}
          className="w-full mt-6 h-16 border-2 border-dashed border-outline-variant/30 rounded flex items-center justify-center gap-2 text-outline-variant hover:text-primary hover:border-primary/50 transition-all group"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          <span className="font-label text-[10px] uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">
            Append Track to Queue
          </span>
        </button>

        {/* Decorative rack finish */}
        <div className="mt-10 flex justify-between items-center opacity-30">
          <div className="v-screw" />
          <div className="h-px flex-grow mx-4 bg-surface-container-highest" />
          <div className="v-screw" />
        </div>
      </section>

      {/* Modals */}
      {showPicker && (
        <SongPicker
          artistId={artistId}
          excludeIds={(entries ?? []).map((e) => e.songId)}
          onPick={addSong}
          onClose={() => setShowPicker(false)}
        />
      )}

      {editingEntry && (
        <EntryEditor
          entry={editingEntry}
          song={songMap[editingEntry.songId]}
          onSave={saveEntryOverrides}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
