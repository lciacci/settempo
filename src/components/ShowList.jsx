import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete, softDeleteWhere } from '../db/db'
import { useAppStore } from '../store/useAppStore'

function ShowRow({ show, index, onOpen, onDelete }) {
  const setlistCount = useLiveQuery(
    () => db.setlists.where('showId').equals(show.id).filter(s => !s.deletedAt).count(),
    [show.id]
  )

  const chanNum = String(index + 1).padStart(2, '0')

  return (
    <li className="bg-surface-container-lowest border border-outline-variant/20 rounded-sm group">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-mono-digital text-[9px] text-outline/50 w-6 flex-shrink-0">{chanNum}</span>

        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <p className="font-label text-on-surface font-semibold text-sm truncate">{show.name}</p>
          <p className="font-mono-digital text-[10px] text-outline mt-0.5">
            {show.date && <span className="mr-2">{show.date}</span>}
            {setlistCount ?? '…'} setlist{setlistCount !== 1 ? 's' : ''}
          </p>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onOpen}
            className="p-1.5 text-outline hover:text-on-surface transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
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

export default function ShowList({ artistId }) {
  const { pushView } = useAppStore()
  const shows = useLiveQuery(
    () => db.shows.where('artistId').equals(artistId).filter(s => !s.deletedAt).reverse().sortBy('date'),
    [artistId]
  )
  const [form, setForm] = useState({ name: '', date: '' })
  const [showForm, setShowForm] = useState(false)

  const addShow = async () => {
    if (!form.name.trim()) return
    const id = await db.shows.add({
      artistId,
      name: form.name.trim(),
      date: form.date || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setForm({ name: '', date: '' })
    setShowForm(false)
    pushView('show-detail', { showId: id })
  }

  const deleteShow = async (show) => {
    if (!confirm(`Delete "${show.name}"?`)) return
    const setlists = await db.setlists.where('showId').equals(show.id).toArray()
    for (const sl of setlists) {
      await softDeleteWhere('setlistSets', 'setlistId', sl.id)
    }
    await softDeleteWhere('setlists', 'showId', show.id)
    await softDelete('shows', show.id)
  }

  return (
    <div className="space-y-4">
      {/* Control strip */}
      <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
          <div className="v-screw" />
          <span className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase flex-1">
            Show Registry · {shows?.length ?? 0} Events
          </span>
          <div className="v-screw" />
        </div>
        <div className="p-3 flex items-center justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Show
          </button>
        </div>
      </div>

      {/* New show form */}
      {showForm && (
        <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low border border-primary/20">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
            <div className="v-screw" />
            <span className="font-mono-digital text-[9px] tracking-[0.3em] text-primary uppercase flex-1">
              New Show Event
            </span>
            <div className="v-screw" />
          </div>
          <div className="p-4 space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Show name (e.g. Venue — April 2026)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addShow()}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-label text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-label text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-2 bg-surface-container-high border border-outline-variant/20 text-outline font-mono-digital text-[10px] uppercase tracking-widest rounded-sm hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addShow}
                className="px-3 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show list */}
      <div className="rack-module rounded-sm bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        {shows?.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">
              No shows registered.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {shows?.map((show, i) => (
              <ShowRow
                key={show.id}
                show={show}
                index={i}
                onOpen={() => pushView('show-detail', { showId: show.id })}
                onDelete={() => deleteShow(show)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
