import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, softDelete, softDeleteWhere } from '../db/db'
import { useAppStore } from '../store/useAppStore'

function SetRow({ set, index, onOpen, onDelete }) {
  const entryCount = useLiveQuery(
    () => db.setEntries.where('setId').equals(set.id).filter(e => !e.deletedAt).count(),
    [set.id]
  )
  const usageCount = useLiveQuery(
    () => db.setlistSets.where('setId').equals(set.id).filter(s => !s.deletedAt).count(),
    [set.id]
  )

  const chanNum = String(index + 1).padStart(2, '0')

  return (
    <li className="bg-surface-container-lowest border border-outline-variant/20 rounded-sm group">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-mono-digital text-[9px] text-outline/50 w-6 flex-shrink-0">{chanNum}</span>

        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <p className="font-label text-on-surface font-semibold text-sm truncate">{set.name}</p>
          <p className="font-mono-digital text-[10px] text-outline mt-0.5">
            {entryCount ?? '…'} track{entryCount !== 1 ? 's' : ''}
            {usageCount != null && usageCount > 0 && (
              <span className="ml-2 text-outline/50">· {usageCount} setlist{usageCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onOpen}
            className="p-1.5 text-outline hover:text-on-surface transition-colors rounded-sm flex items-center gap-1"
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

export default function SetLibrary({ artistId }) {
  const { pushView } = useAppStore()
  const sets = useLiveQuery(
    () => db.sets.where('artistId').equals(artistId).filter(s => !s.deletedAt).sortBy('name'),
    [artistId]
  )
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const addSet = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = await db.sets.add({ artistId, name: trimmed, createdAt: Date.now(), updatedAt: Date.now() })
    setName('')
    setShowForm(false)
    pushView('set-editor', { setId: id })
  }

  const deleteSet = async (set) => {
    const usage = await db.setlistSets.where('setId').equals(set.id).count()
    if (usage > 0) {
      alert(`Cannot delete — this set is used in ${usage} setlist${usage !== 1 ? 's' : ''}.`)
      return
    }
    if (!confirm(`Delete "${set.name}"?`)) return
    await softDeleteWhere('setEntries', 'setId', set.id)
    await softDelete('sets', set.id)
  }

  return (
    <div className="space-y-4">
      {/* Control strip */}
      <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
          <div className="v-screw" />
          <span className="font-mono-digital text-[9px] tracking-[0.3em] text-outline uppercase flex-1">
            Set Registry · {sets?.length ?? 0} Modules
          </span>
          <div className="v-screw" />
        </div>
        <div className="p-3 flex items-center justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Set
          </button>
        </div>
      </div>

      {/* New set form */}
      {showForm && (
        <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low border border-primary/20">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/20">
            <div className="v-screw" />
            <span className="font-mono-digital text-[9px] tracking-[0.3em] text-primary uppercase flex-1">
              New Set Module
            </span>
            <div className="v-screw" />
          </div>
          <div className="p-4 flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="SET NAME (e.g. Set 1, Encore)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSet()}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-label text-sm px-3 py-2 rounded-sm outline-none focus:border-primary/50 placeholder:text-outline/40"
            />
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-surface-container-high border border-outline-variant/20 text-outline font-mono-digital text-[10px] uppercase tracking-widest rounded-sm hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addSet}
              className="px-3 py-2 bg-primary-container text-on-primary font-headline font-bold text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Set list */}
      <div className="rack-module rounded-sm bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        {sets?.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">
              No sets registered.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {sets?.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                index={i}
                onOpen={() => pushView('set-editor', { setId: set.id })}
                onDelete={() => deleteSet(set)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
