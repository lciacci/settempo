import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'

function ArtistModule({ artist, index, onSelect, onEngage }) {
  const songCount = useLiveQuery(() => db.songs.where('artistId').equals(artist.id).filter(s => !s.deletedAt).count(), [artist.id])
  const setCount = useLiveQuery(() => db.sets.where('artistId').equals(artist.id).filter(s => !s.deletedAt).count(), [artist.id])

  const moduleNum = String(index + 1).padStart(2, '0')
  const slugName = artist.name.replace(/\s+/g, '_').toUpperCase()

  return (
    <div className="bg-surface-container-high p-5 md:p-6 rounded-lg border border-white/5 module-card-shadow relative group overflow-hidden">
      <div className="absolute top-3 left-3" style={{ transform: 'scale(0.5)', opacity: 0.4 }}><div className="screw-head" /></div>
      <div className="absolute top-3 right-3" style={{ transform: 'scale(0.5)', opacity: 0.4 }}><div className="screw-head" /></div>

      <div className="flex justify-between items-start mb-5 gap-4">
        {/* CRT screen inset */}
        <div className="bg-surface-container-lowest rounded p-4 flex-1 border border-outline-variant/30 relative overflow-hidden crt-glow min-w-0">
          <div className="scanline-overlay absolute inset-0 opacity-20 pointer-events-none" />
          <div className="relative z-10">
            <p className="font-mono-digital text-[9px] text-primary/70 tracking-widest uppercase mb-1">Module_{moduleNum}</p>
            <h3 className="font-headline text-xl md:text-2xl font-black text-primary leading-none mb-1 tracking-tight truncate">
              {slugName}
            </h3>
            <p className="font-mono-digital text-[10px] text-primary/50 tracking-tight font-bold">
              ARTIST: {artist.name}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="text-right pt-1 flex-shrink-0">
          <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">SONGS</p>
          <p className="text-2xl font-black text-primary font-headline leading-tight">
            {String(songCount ?? 0).padStart(2, '0')}
          </p>
          <p className="font-mono-digital text-[9px] text-on-surface-variant uppercase tracking-widest mt-1 font-black">
            SETS: {String(setCount ?? 0).padStart(2, '0')}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onEngage}
          className="flex-1 bg-surface-container-highest hover:bg-primary-container transition-all group/btn border-b-4 border-black active:translate-y-1 rounded py-3 flex items-center justify-center gap-2"
        >
          <span
            className="material-symbols-outlined text-primary group-hover/btn:text-on-primary text-base"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_arrow
          </span>
          <span className="font-label text-[10px] font-black tracking-[0.2em] text-on-surface group-hover/btn:text-on-primary uppercase">
            Engage Set
          </span>
        </button>
        <button
          onClick={onSelect}
          className="w-14 bg-surface-container-highest hover:bg-surface-bright transition-colors border-b-4 border-black rounded flex items-center justify-center text-outline hover:text-primary"
        >
          <span className="material-symbols-outlined">edit</span>
        </button>
      </div>
    </div>
  )
}

export default function ArtistList({ onSelect, onEngage }) {
  const { setCurrentArtistId } = useAppStore()
  const artists = useLiveQuery(() => db.artists.filter(a => !a.deletedAt).toArray(), [])
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const addArtist = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = await db.artists.add({ name: trimmed, createdAt: Date.now(), updatedAt: Date.now() })
    setName('')
    setShowForm(false)
    setCurrentArtistId(id)
    onSelect?.(id)
  }

  const totalModules = (artists?.length ?? 0) + 2
  const showEmptySlot = (artists?.length ?? 0) % 2 === 1

  return (
    <div className="relative bg-surface-container-low rounded-lg p-1 brushed-metal shadow-[0_35px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden ring-1 ring-white/10">
      {/* Corner screws */}
      <div className="absolute top-4 left-4"><div className="screw-head" /></div>
      <div className="absolute top-4 right-4"><div className="screw-head" /></div>
      <div className="absolute bottom-4 left-4"><div className="screw-head" /></div>
      <div className="absolute bottom-4 right-4"><div className="screw-head" /></div>

      <div className="p-6 md:p-12 space-y-8 md:space-y-12">
        {/* Header */}
        <div className="flex justify-between items-end border-b-2 border-white/5 pb-6">
          <div>
            <span className="font-mono-digital text-[9px] tracking-[0.5em] text-outline uppercase font-black">
              Archive Console V.2.0
            </span>
            <h1 className="text-3xl md:text-5xl font-headline font-black text-primary-container uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(255,179,0,0.3)]">
              Library Archive
            </h1>
          </div>
          <div className="flex gap-2 md:gap-3 pb-2">
            <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-primary-container data-led" />
            <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-surface-container-highest shadow-inner" />
            <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-surface-container-highest shadow-inner" />
          </div>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {artists?.map((artist, i) => (
            <ArtistModule
              key={artist.id}
              artist={artist}
              index={i}
              onSelect={() => { setCurrentArtistId(artist.id); onSelect?.(artist.id) }}
              onEngage={() => { setCurrentArtistId(artist.id); onEngage?.(artist.id) }}
            />
          ))}

          {/* Empty slot (fills gap when odd count) */}
          {showEmptySlot && (
            <div className="hidden md:flex bg-surface-container-low/50 p-6 rounded-lg border border-dashed border-outline-variant/30 module-card-shadow grayscale opacity-40 items-center justify-center h-48">
              <div className="text-center">
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em] font-black mb-2">
                  Module_{String((artists?.length ?? 0) + 1).padStart(2, '0')}
                </p>
                <p className="font-headline text-lg font-bold text-outline-variant uppercase">Archive Slot Empty</p>
              </div>
            </div>
          )}

          {/* New module / form */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-48 bg-surface-container-high border-2 border-dashed border-outline-variant/30 rounded-lg flex flex-col items-center justify-center group hover:border-primary/50 transition-all active:scale-[0.98] module-card-shadow"
            >
              <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary-container transition-colors shadow-2xl">
                <span className="material-symbols-outlined text-primary group-hover:text-on-primary text-4xl">add</span>
              </div>
              <p className="font-mono-digital text-[9px] font-black tracking-[0.5em] text-outline group-hover:text-primary uppercase transition-colors">
                Initialize New Module
              </p>
            </button>
          ) : (
            <div className="h-48 bg-surface-container-high border-2 border-primary/30 rounded-lg p-5 flex flex-col justify-center gap-4 module-card-shadow">
              <p className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase">
                MODULE DESIGNATION
              </p>
              <input
                autoFocus
                type="text"
                placeholder="ARTIST_NAME"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addArtist()}
                className="bg-surface-container-lowest border border-outline-variant/30 text-primary font-mono-digital text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/60 uppercase tracking-widest placeholder:text-outline/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setName('') }}
                  className="flex-1 py-2 bg-surface-container-highest border border-outline-variant/20 text-outline font-mono-digital text-[10px] uppercase tracking-widest rounded-sm hover:text-on-surface transition-colors"
                >
                  Abort
                </button>
                <button
                  onClick={addArtist}
                  className="flex-1 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all"
                >
                  Initialize
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex justify-center pt-2 md:pt-4 border-t border-white/10">
          <div className="flex items-center gap-6 md:gap-8 px-8 md:px-14 py-3 md:py-4 bg-surface-container-lowest rounded-full border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-container data-led" />
              <span className="font-mono-digital text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Archive Online
              </span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <span className="font-mono-digital text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
              Active Modules: {String(artists?.length ?? 0).padStart(2, '0')}/{String(Math.max(32, totalModules)).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
