import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, softDelete } from '../db/db'
import { exportSetlistPrint, exportSetlistHTML } from './SetlistExport'

function SetPicker({ artistId, onPick, onClose }) {
  const sets = useLiveQuery(
    () => db.sets.where('artistId').equals(artistId).filter(s => !s.deletedAt).sortBy('name'),
    [artistId]
  )

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg w-full max-w-md max-h-[60vh] flex flex-col relative overflow-hidden">
        <div className="absolute top-3 left-3"><div className="screw-head" /></div>
        <div className="absolute top-3 right-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 left-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 right-3"><div className="screw-head" /></div>

        <div className="border-b border-outline-variant/20 px-8 pt-6 pb-4 flex items-center justify-between">
          <div>
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em]">Set Library</p>
            <h3 className="font-headline font-black text-primary uppercase tracking-tight">Add Set</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-outline hover:text-primary transition-colors rounded">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <ul className="overflow-y-auto flex-1 px-6 py-4 space-y-1">
          {sets?.map((set) => (
            <li key={set.id} className="border border-outline-variant/20 rounded-sm overflow-hidden">
              <button
                onClick={() => onPick(set, false)}
                className="w-full text-left px-4 py-3 hover:bg-surface-container-high transition-colors border-b border-outline-variant/10"
              >
                <p className="font-headline font-black text-on-surface text-sm uppercase tracking-wide">{set.name}</p>
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mt-0.5">Shared reference</p>
              </button>
              <button
                onClick={() => onPick(set, true)}
                className="w-full text-left px-4 py-2 hover:bg-surface-container-high transition-colors"
              >
                <p className="font-mono-digital text-[9px] text-on-surface-variant uppercase tracking-widest">+ Add as local copy (independent)</p>
              </button>
            </li>
          ))}
          {sets?.length === 0 && (
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest p-4 text-center">
              No sets in library. Create sets in the Sets tab first.
            </p>
          )}
        </ul>
      </div>
    </div>
  )
}

function SortableSetRow({ row, set, onRemove, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id })
  const entryCount = useLiveQuery(
    () => set ? db.setEntries.where('setId').equals(set.id).filter(e => !e.deletedAt).count() : Promise.resolve(null),
    [set?.id]
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-surface-container-high border border-outline-variant/20 rounded-sm flex items-center gap-3 px-3 py-3"
    >
      <span className="font-mono-digital text-[9px] text-outline w-5 text-center flex-shrink-0">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span
        {...attributes}
        {...listeners}
        className="text-outline hover:text-primary cursor-grab active:cursor-grabbing select-none flex-shrink-0"
      >
        <span className="material-symbols-outlined text-sm">drag_indicator</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-headline font-black text-on-surface uppercase tracking-wide text-sm truncate">
          {set?.name ?? '(deleted set)'}
        </p>
        <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest mt-0.5">
          {entryCount ?? '…'} song{entryCount !== 1 ? 's' : ''}
          {row.isLocalCopy && <span className="ml-2 text-primary-container">local copy</span>}
        </p>
      </div>
      <button
        onClick={() => onRemove(row.id)}
        className="text-outline hover:text-[#9B2226] transition-colors flex-shrink-0 p-1"
      >
        <span className="material-symbols-outlined text-sm">remove_circle</span>
      </button>
    </li>
  )
}

export default function SetlistDetail({ setlistId, artistId }) {
  const [showPicker, setShowPicker] = useState(false)

  const setlist = useLiveQuery(() => db.setlists.get(setlistId), [setlistId])
  const setlistSets = useLiveQuery(
    () => db.setlistSets.where('setlistId').equals(setlistId).filter(r => !r.deletedAt).sortBy('position'),
    [setlistId]
  )

  const setIds = (setlistSets ?? []).map((r) => r.setId)
  const sets = useLiveQuery(
    () => setIds.length ? db.sets.where('id').anyOf(setIds).toArray() : [],
    [JSON.stringify(setIds)]
  )
  const setMap = Object.fromEntries((sets ?? []).map((s) => [s.id, s]))

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id || !setlistSets) return
    const oldIndex = setlistSets.findIndex((r) => r.id === active.id)
    const newIndex = setlistSets.findIndex((r) => r.id === over.id)
    const reordered = arrayMove(setlistSets, oldIndex, newIndex)
    await Promise.all(
      reordered.map((row, i) => db.setlistSets.update(row.id, { position: i, updatedAt: Date.now() }))
    )
  }

  const addSet = async (set, isLocalCopy) => {
    const pos = setlistSets?.length ?? 0
    await db.setlistSets.add({
      setlistId,
      setId: set.id,
      position: pos,
      isLocalCopy: isLocalCopy ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setShowPicker(false)
  }

  const removeSet = async (id) => {
    await softDelete('setlistSets', id)
  }

  const rowIds = (setlistSets ?? []).map((r) => r.id)

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
          <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.5em] mb-1">Setlist Editor</p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h2 className="font-headline font-black text-primary-container text-3xl md:text-4xl uppercase tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,179,0,0.3)]">
              {setlist?.name ?? '…'}
            </h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => exportSetlistHTML(setlistId)}
                className="px-3 py-2 border border-outline-variant/20 hover:border-outline-variant/50 text-outline hover:text-on-surface font-mono-digital text-[9px] uppercase tracking-widest rounded-sm transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">code</span>
                HTML
              </button>
              <button
                onClick={() => exportSetlistPrint(setlistId)}
                className="px-3 py-2 border border-outline-variant/20 hover:border-outline-variant/50 text-outline hover:text-on-surface font-mono-digital text-[9px] uppercase tracking-widest rounded-sm transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print / PDF
              </button>
              <button
                onClick={() => setShowPicker(true)}
                className="px-3 py-2 bg-primary-container text-on-primary font-headline font-black text-[9px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Set
              </button>
            </div>
          </div>
        </div>

        {/* Set rows */}
        {setlistSets && setlistSets.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {setlistSets.map((row, i) => (
                  <SortableSetRow
                    key={row.id}
                    row={row}
                    set={setMap[row.setId]}
                    onRemove={removeSet}
                    index={i}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="border border-dashed border-outline-variant/30 rounded-sm p-12 text-center">
            <span className="material-symbols-outlined text-3xl text-outline block mb-3">queue_music</span>
            <p className="font-mono-digital text-[10px] text-outline uppercase tracking-widest">No sets loaded. Add one from your Set Library.</p>
          </div>
        )}

        {/* Status bar */}
        <div className="border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary-container data-led flex-shrink-0" />
          <span className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">
            {setlistSets?.length ?? 0} set{setlistSets?.length !== 1 ? 's' : ''} in setlist
          </span>
        </div>
      </div>

      {showPicker && (
        <SetPicker artistId={artistId} onPick={addSet} onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
