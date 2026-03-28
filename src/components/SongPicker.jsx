import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export default function SongPicker({ artistId, excludeIds = [], onPick, onClose }) {
  const [search, setSearch] = useState('')
  const songs = useLiveQuery(
    () => db.songs.where('artistId').equals(artistId).filter(s => !s.deletedAt).sortBy('title'),
    [artistId]
  )

  const filtered = songs?.filter(
    (s) =>
      !excludeIds.includes(s.id) &&
      s.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg w-full max-w-md max-h-[70vh] flex flex-col relative overflow-hidden">
        <div className="absolute top-3 left-3"><div className="screw-head" /></div>
        <div className="absolute top-3 right-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 left-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 right-3"><div className="screw-head" /></div>

        <div className="border-b border-outline-variant/20 px-8 pt-6 pb-4 flex items-center justify-between">
          <div>
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em]">Song Library</p>
            <h3 className="font-headline font-black text-primary uppercase tracking-tight">Add Song</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-outline hover:text-primary transition-colors rounded">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 pt-4 pb-2">
          <input
            autoFocus
            type="text"
            placeholder="Search songs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono-digital text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/60 placeholder:text-outline/40"
          />
        </div>

        <ul className="overflow-y-auto flex-1 px-6 py-2 space-y-1">
          {filtered?.map((song) => (
            <li key={song.id}>
              <button
                onClick={() => onPick(song)}
                className="w-full text-left px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm hover:bg-surface-bright hover:border-primary/30 transition-all group"
              >
                <p className="font-headline font-black text-on-surface text-sm uppercase tracking-wide group-hover:text-primary transition-colors">
                  {song.title}
                </p>
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mt-0.5">
                  {song.bpm} BPM · {song.timeSigN}/{song.timeSigD}
                </p>
              </button>
            </li>
          ))}
          {filtered?.length === 0 && (
            <div className="text-center py-8">
              <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">No songs found.</p>
            </div>
          )}
        </ul>

        <div className="border-t border-outline-variant/20 px-8 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary-container flex-shrink-0" />
          <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">
            {filtered?.length ?? 0} song{filtered?.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </div>
  )
}
