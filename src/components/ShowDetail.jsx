import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete, softDeleteWhere } from '../db/db'
import { useAppStore } from '../store/useAppStore'

function SetlistRow({ setlist, onOpen, onDelete }) {
  const setCount = useLiveQuery(
    () => db.setlistSets.where('setlistId').equals(setlist.id).filter(s => !s.deletedAt).count(),
    [setlist.id]
  )

  return (
    <li className="bg-surface-container-high border border-outline-variant/20 rounded-sm flex items-center gap-3 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <button onClick={onOpen} className="text-left w-full">
          <p className="font-headline font-black text-on-surface uppercase tracking-wide text-sm group-hover:text-primary transition-colors">
            {setlist.name}
          </p>
          <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mt-0.5">
            {setCount ?? '…'} set{setCount !== 1 ? 's' : ''}
          </p>
        </button>
      </div>
      <button
        onClick={onOpen}
        className="p-1.5 text-outline hover:text-primary transition-colors rounded"
      >
        <span className="material-symbols-outlined text-sm">open_in_new</span>
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 text-outline hover:text-[#9B2226] transition-colors rounded"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
      </button>
    </li>
  )
}

export default function ShowDetail({ showId }) {
  const { pushView } = useAppStore()
  const show = useLiveQuery(() => db.shows.get(showId), [showId])
  const setlists = useLiveQuery(
    () => db.setlists.where('showId').equals(showId).filter(s => !s.deletedAt).toArray(),
    [showId]
  )
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const addSetlist = async () => {
    if (!name.trim()) return
    const id = await db.setlists.add({ showId, name: name.trim(), createdAt: Date.now(), updatedAt: Date.now() })
    setName('')
    setShowForm(false)
    pushView('setlist-detail', { setlistId: id })
  }

  const deleteSetlist = async (sl) => {
    if (!confirm(`Delete "${sl.name}"?`)) return
    await softDeleteWhere('setlistSets', 'setlistId', sl.id)
    await softDelete('setlists', sl.id)
  }

  return (
    <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg relative overflow-hidden">
      {/* Corner screws */}
      <div className="absolute top-4 left-4"><div className="screw-head" /></div>
      <div className="absolute top-4 right-4"><div className="screw-head" /></div>
      <div className="absolute bottom-4 left-4"><div className="screw-head" /></div>
      <div className="absolute bottom-4 right-4"><div className="screw-head" /></div>

      <div className="p-6 md:p-10 space-y-6">
        {/* Header */}
        <div className="border-b border-white/5 pb-6">
          <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.5em] mb-1">Show Record</p>
          <h2 className="font-headline font-black text-primary-container text-3xl md:text-4xl uppercase tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,179,0,0.3)]">
            {show?.name ?? '…'}
          </h2>
          {show?.date && (
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest mt-2">{show.date}</p>
          )}
        </div>

        {/* Setlists header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em]">Sub-System</p>
            <h3 className="font-headline font-black text-on-surface uppercase tracking-tight">Setlists</h3>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-2 bg-primary-container text-on-primary font-headline font-black text-[9px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Setlist
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-sm p-4 space-y-3">
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">Setlist Designation</p>
            <input
              autoFocus
              type="text"
              placeholder="SETLIST_NAME"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSetlist()}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 text-primary font-mono-digital text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/60 uppercase tracking-widest placeholder:text-outline/40"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setName('') }}
                className="flex-1 py-2 border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors"
              >
                Abort
              </button>
              <button
                onClick={addSetlist}
                className="flex-1 py-2 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all"
              >
                Initialize
              </button>
            </div>
          </div>
        )}

        {/* Setlist rows */}
        {setlists && setlists.length > 0 ? (
          <ul className="space-y-2">
            {setlists.map((sl) => (
              <SetlistRow
                key={sl.id}
                setlist={sl}
                onOpen={() => pushView('setlist-detail', { setlistId: sl.id })}
                onDelete={() => deleteSetlist(sl)}
              />
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-outline-variant/30 rounded-sm p-10 text-center">
            <span className="material-symbols-outlined text-3xl text-outline block mb-3">playlist_add</span>
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">No setlists yet. Add one above.</p>
          </div>
        )}

        {/* Status bar */}
        <div className="border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary-container data-led flex-shrink-0" />
          <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">
            {setlists?.length ?? 0} setlist{setlists?.length !== 1 ? 's' : ''} on record
          </span>
        </div>
      </div>
    </div>
  )
}
