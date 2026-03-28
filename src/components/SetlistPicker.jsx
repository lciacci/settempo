import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export default function SetlistPicker({ artistId, onPick, onClose }) {
  const shows = useLiveQuery(
    () => db.shows.where('artistId').equals(artistId).filter(s => !s.deletedAt).sortBy('name'),
    [artistId]
  )
  const setlists = useLiveQuery(() => db.setlists.filter(s => !s.deletedAt).toArray(), [])
  const setlistSets = useLiveQuery(() => db.setlistSets.filter(s => !s.deletedAt).toArray(), [])

  const showSetlists = shows?.flatMap((show) =>
    (setlists ?? [])
      .filter((sl) => sl.showId === show.id)
      .map((sl) => ({
        ...sl,
        showName: show.name,
        showDate: show.date,
        setCount: (setlistSets ?? []).filter((ss) => ss.setlistId === sl.id).length,
      }))
  )

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg w-full max-w-md max-h-[75vh] flex flex-col relative overflow-hidden">

        {/* Corner screws */}
        <div className="absolute top-3 left-3"><div className="screw-head" /></div>
        <div className="absolute top-3 right-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 left-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 right-3"><div className="screw-head" /></div>

        {/* Header */}
        <div className="border-b border-outline-variant/20 px-8 pt-7 pb-5 flex items-start justify-between">
          <div>
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em]">Performance Mode</p>
            <h3 className="font-headline font-black text-primary uppercase tracking-tight text-2xl">Choose Setlist</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-outline hover:text-primary transition-colors rounded mt-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* List */}
        <ul className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {showSetlists?.map((sl) => (
            <li key={sl.id}>
              <button
                onClick={() => onPick(sl.id)}
                className="w-full text-left px-4 py-4 bg-surface-container-high border border-outline-variant/20 rounded-sm hover:bg-surface-bright hover:border-primary/30 transition-all group"
              >
                <p className="font-headline font-black text-on-surface uppercase tracking-wide group-hover:text-primary transition-colors">
                  {sl.name}
                </p>
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mt-1">
                  {sl.showName}{sl.showDate ? ` · ${sl.showDate}` : ''} · {sl.setCount} set{sl.setCount !== 1 ? 's' : ''}
                </p>
              </button>
            </li>
          ))}

          {showSetlists?.length === 0 && (
            <div className="text-center py-10 px-4">
              <span className="material-symbols-outlined text-3xl text-outline block mb-3">event_note</span>
              <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">
                No setlists found.
              </p>
              <p className="font-mono-digital text-[9px] text-outline/60 uppercase tracking-widest mt-1">
                Create a show and setlist in the Library first.
              </p>
            </div>
          )}
        </ul>

        {/* Footer status */}
        <div className="border-t border-outline-variant/20 px-8 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#9B2226] flex-shrink-0" style={{ boxShadow: '0 0 8px rgba(155,34,38,0.7)' }} />
          <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">
            {showSetlists?.length ?? 0} setlist{showSetlists?.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </div>
  )
}
