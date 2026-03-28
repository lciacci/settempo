import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete, softDeleteWhere } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import SongGridView from './SongGridView'
import SongImport from './SongImport'

const DEFAULT_SONG = { title: '', bpm: 120, timeSigN: 4, timeSigD: 4, notes: '' }

function useSongUsage(songId) {
  return useLiveQuery(
    () => db.setEntries.where('songId').equals(songId).filter(e => !e.deletedAt).count(),
    [songId]
  )
}

function SongRow({ song, index, onEdit, onDelete, onLoad }) {
  const usage = useSongUsage(song.id)

  const chanNum = String(index + 1).padStart(2, '0')

  return (
    <li className="bg-surface-container-lowest border border-outline-variant/20 rounded-sm group relative">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Channel number */}
        <span className="font-mono-digital text-[9px] text-outline/50 w-6 flex-shrink-0">{chanNum}</span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-label text-on-surface font-semibold text-sm truncate">{song.title}</p>
          <p className="font-mono-digital text-[10px] text-outline mt-0.5">
            {song.bpm} BPM · {song.timeSigN}/{song.timeSigD}
            {usage != null && usage > 0 && (
              <span className="ml-2 text-outline/50">· {usage} set{usage !== 1 ? 's' : ''}</span>
            )}
            {song.notes && (
              <span className="ml-2 text-outline/50 italic">{song.notes}</span>
            )}
          </p>
        </div>

        {/* BPM badge */}
        <span className="font-mono-digital text-primary text-sm font-bold flex-shrink-0 hidden sm:block">
          {String(song.bpm).padStart(3, '0')}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onLoad}
            title="Load to metronome"
            className="p-1.5 text-primary hover:bg-primary-container/30 transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-outline hover:text-on-surface transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-outline/40 hover:text-error transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    </li>
  )
}

export default function SongLibrary({ artistId, onLoadSong }) {
  const { setMetronome } = useAppStore()
  const allSongs = useLiveQuery(
    () => db.songs.where('artistId').equals(artistId).filter(s => !s.deletedAt).sortBy('title'),
    [artistId]
  )

  const [form, setForm] = useState(DEFAULT_SONG)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterBpmMin, setFilterBpmMin] = useState('')
  const [filterBpmMax, setFilterBpmMax] = useState('')
  const [gridMode, setGridMode] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const resetForm = () => { setForm(DEFAULT_SONG); setEditingId(null); setShowForm(false) }
  const openNew = () => { setForm(DEFAULT_SONG); setEditingId(null); setShowForm(true) }
  const openEdit = (song) => {
    setForm({ title: song.title, bpm: song.bpm, timeSigN: song.timeSigN, timeSigD: song.timeSigD, notes: song.notes || '' })
    setEditingId(song.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) return
    const data = {
      artistId,
      title: form.title.trim(),
      bpm: Number(form.bpm),
      timeSigN: Number(form.timeSigN),
      timeSigD: Number(form.timeSigD),
      notes: form.notes,
      updatedAt: Date.now(),
    }
    if (editingId) {
      await db.songs.update(editingId, data)
    } else {
      await db.songs.add({ ...data, createdAt: Date.now() })
    }
    resetForm()
  }

  const deleteSong = async (song) => {
    const usage = await db.setEntries.where('songId').equals(song.id).count()
    if (usage > 0) {
      if (!confirm(`"${song.title}" is used in ${usage} set entr${usage !== 1 ? 'ies' : 'y'}. Delete anyway?`)) return
    } else {
      if (!confirm(`Delete "${song.title}"?`)) return
    }
    await softDeleteWhere('setEntries', 'songId', song.id)
    await softDelete('songs', song.id)
  }

  const songs = allSongs?.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterBpmMin && s.bpm < Number(filterBpmMin)) return false
    if (filterBpmMax && s.bpm > Number(filterBpmMax)) return false
    return true
  })

  if (gridMode) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 112px)' }}>
        <SongGridView artistId={artistId} songs={allSongs} onClose={() => setGridMode(false)} />
        {showImport && <SongImport artistId={artistId} onClose={() => setShowImport(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Control strip */}
      <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
          <div className="v-screw" />
          <span className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase flex-1">
            Song Registry · {allSongs?.length ?? 0} Entries
          </span>
          <div className="v-screw" />
        </div>

        <div className="p-3 flex flex-wrap gap-2 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="SEARCH TITLE…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-32 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-[11px] px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40 uppercase tracking-widest"
          />
          <input
            type="number"
            placeholder="BPM↑"
            value={filterBpmMin}
            onChange={(e) => setFilterBpmMin(e.target.value)}
            className="w-20 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-[11px] px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40"
          />
          <input
            type="number"
            placeholder="BPM↓"
            value={filterBpmMax}
            onChange={(e) => setFilterBpmMax(e.target.value)}
            className="w-20 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-[11px] px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40"
          />

          {/* Action buttons */}
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 bg-surface-container-high border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">upload</span>
            Import
          </button>
          <button
            onClick={() => setGridMode(true)}
            className="px-3 py-2 bg-surface-container-high border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">grid_view</span>
            Grid
          </button>
          <button
            onClick={openNew}
            className="px-3 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Track
          </button>
        </div>
      </div>

      {/* New/Edit form */}
      {showForm && (
        <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low border border-primary/20">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
            <div className="v-screw" />
            <span className="font-mono-digital text-[9px] tracking-[0.3em] text-primary uppercase flex-1">
              {editingId ? 'Edit Track' : 'New Track'}
            </span>
            <div className="v-screw" />
          </div>
          <div className="p-4 space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="TRACK TITLE"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-label text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40"
            />
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-1 flex-1 min-w-20">
                <label className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">BPM</label>
                <input
                  type="number" min={1} max={300}
                  value={form.bpm}
                  onChange={(e) => setForm({ ...form, bpm: e.target.value })}
                  className="bg-surface-container-lowest border border-outline-variant/30 text-primary font-mono-digital text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">Time Sig</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={1} max={16}
                    value={form.timeSigN}
                    onChange={(e) => setForm({ ...form, timeSigN: e.target.value })}
                    className="w-14 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-sm px-2 py-2 text-center rounded-sm outline-none focus:border-primary/50"
                  />
                  <span className="text-outline font-mono-digital">/</span>
                  <select
                    value={form.timeSigD}
                    onChange={(e) => setForm({ ...form, timeSigD: e.target.value })}
                    className="w-14 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-sm px-2 py-2 rounded-sm outline-none focus:border-primary/50"
                  >
                    {[2, 4, 8, 16].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <textarea
              placeholder="Notes (key, capo, cues…)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-body text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50 resize-none placeholder:text-outline/40"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-surface-container-high border border-outline-variant/20 text-outline font-mono-digital text-[10px] uppercase tracking-widest rounded-sm hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
              >
                {editingId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song list */}
      <div className="rack-module rounded-sm bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        {songs?.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">
              {allSongs?.length === 0 ? 'No tracks registered.' : 'No tracks match filter.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {songs?.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                onEdit={() => openEdit(song)}
                onDelete={() => deleteSong(song)}
                onLoad={() => { setMetronome({ bpm: song.bpm, timeSignatureNumerator: song.timeSigN, timeSignatureDenominator: song.timeSigD }); onLoadSong?.() }}
              />
            ))}
          </ul>
        )}
      </div>

      {showImport && (
        <SongImport artistId={artistId} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
