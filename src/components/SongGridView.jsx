import { useState, useRef, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, softDelete, softDeleteWhere } from '../db/db'

const EMPTY_ROW = { title: '', bpm: '120', timeSigN: '4', timeSigD: '4', notes: '' }

function GridCell({ value, onChange, onKeyDown, type = 'text', className = '', inputRef }) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`bg-transparent text-primary outline-none w-full px-2 py-1 focus:bg-surface-container-highest rounded font-mono-digital text-xs ${className}`}
    />
  )
}

function SortableRow({ song, index, onUpdate, onDelete, onKeyDown, isNew, cellRefs }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: song.id ?? `new-${index}` })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const update = (field) => (val) => onUpdate(index, field, val)

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-outline-variant/20 ${isNew ? 'bg-surface-container/40' : 'hover:bg-surface-container-high/30'}`}
    >
      <td className="w-8 px-2 py-1 text-outline text-center font-mono-digital text-[10px]">{String(index + 1).padStart(2, '0')}</td>
      <td
        className="w-6 px-1 py-1 cursor-grab active:cursor-grabbing text-outline hover:text-primary text-center select-none"
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-outlined text-sm">drag_indicator</span>
      </td>
      <td className="min-w-48 px-0 py-0.5">
        <GridCell value={song.title} onChange={update('title')}
          onKeyDown={(e) => onKeyDown(e, index, 'title')}
          inputRef={cellRefs?.[index]?.title} />
      </td>
      <td className="w-20 px-0 py-0.5">
        <GridCell value={song.bpm} onChange={update('bpm')}
          type="number"
          onKeyDown={(e) => onKeyDown(e, index, 'bpm')}
          inputRef={cellRefs?.[index]?.bpm}
          className="text-right" />
      </td>
      <td className="w-10 px-0 py-0.5">
        <GridCell value={song.timeSigN} onChange={update('timeSigN')}
          type="number"
          onKeyDown={(e) => onKeyDown(e, index, 'timeSigN')}
          inputRef={cellRefs?.[index]?.timeSigN}
          className="text-center" />
      </td>
      <td className="w-4 text-outline text-center font-mono-digital text-[10px]">/</td>
      <td className="w-10 px-0 py-0.5">
        <select
          value={song.timeSigD}
          onChange={(e) => update('timeSigD')(e.target.value)}
          className="bg-transparent text-primary font-mono-digital text-xs w-full px-1 py-1 outline-none focus:bg-surface-container-highest rounded"
        >
          {[2, 4, 8, 16].map((d) => <option key={d} className="bg-surface-container-highest text-primary">{d}</option>)}
        </select>
      </td>
      <td className="min-w-32 px-0 py-0.5">
        <GridCell value={song.notes || ''} onChange={update('notes')}
          onKeyDown={(e) => onKeyDown(e, index, 'notes')}
          inputRef={cellRefs?.[index]?.notes} />
      </td>
      <td className="w-8 px-1 py-1 text-center">
        <button onClick={() => onDelete(index)} className="text-outline hover:text-[#9B2226] transition-colors">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </td>
    </tr>
  )
}

export default function SongGridView({ artistId, songs, onClose }) {
  const [rows, setRows] = useState(() =>
    (songs ?? []).map((s) => ({ ...s, bpm: String(s.bpm), timeSigN: String(s.timeSigN), timeSigD: String(s.timeSigD) }))
  )
  const [saving, setSaving] = useState(false)
  const cellRefs = useRef({})
  const sensors = useSensors(useSensor(PointerSensor))

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { ...EMPTY_ROW, _new: true, _tempId: Date.now() }])
  }, [])

  const updateRow = useCallback((index, field, value) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const deleteRow = useCallback((index) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleKeyDown = useCallback((e, rowIndex, field) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && field === 'notes' && rowIndex === rows.length - 1)) {
      e.preventDefault()
      addRow()
      setTimeout(() => {
        cellRefs.current[rows.length]?.title?.focus()
      }, 20)
    }
  }, [rows.length, addRow])

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIdx = prev.findIndex((r) => (r.id ?? `new-${prev.indexOf(r)}`) === active.id)
      const newIdx = prev.findIndex((r) => (r.id ?? `new-${prev.indexOf(r)}`) === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }, [])

  const saveAll = useCallback(async () => {
    setSaving(true)
    try {
      const existingIds = new Set((songs ?? []).map((s) => s.id))
      const submittedIds = new Set(rows.filter((r) => r.id).map((r) => r.id))

      for (const id of existingIds) {
        if (!submittedIds.has(id)) {
          await softDeleteWhere('setEntries', 'songId', id)
          await softDelete('songs', id)
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.title.trim()) continue
        const data = {
          artistId,
          title: r.title.trim(),
          bpm: Math.min(300, Math.max(1, Number(r.bpm) || 120)),
          timeSigN: Math.min(16, Math.max(1, Number(r.timeSigN) || 4)),
          timeSigD: Number(r.timeSigD) || 4,
          notes: r.notes || '',
          updatedAt: Date.now(),
        }
        if (r.id) {
          await db.songs.update(r.id, data)
        } else {
          await db.songs.add({ ...data, createdAt: Date.now() })
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }, [rows, songs, artistId, onClose])

  const rowIds = rows.map((r, i) => r.id ?? `new-${i}`)

  return (
    <div className="flex flex-col h-full bg-surface-container-low brushed-metal rack-panel rounded-lg overflow-hidden">

      {/* Header */}
      <div className="relative bg-surface-container-lowest border-b border-outline-variant/20 px-4 py-3 flex items-center justify-between gap-4">
        <div className="absolute top-2 left-2"><div className="v-screw" /></div>
        <div className="absolute top-2 right-2"><div className="v-screw" /></div>

        <div className="pl-4">
          <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">Sub-System 03</p>
          <h3 className="font-headline font-black text-primary uppercase tracking-tight text-sm">Grid Editor</h3>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-high border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors"
          >
            Abort
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-4 py-2 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all disabled:opacity-40"
          >
            {saving ? 'Writing…' : 'Commit All'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface-container-lowest z-10 border-b border-outline-variant/30">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-mono-digital text-[9px] text-outline uppercase tracking-widest">#</th>
              <th className="w-6"></th>
              <th className="min-w-48 px-2 py-2 text-left font-mono-digital text-[9px] text-outline uppercase tracking-widest">Title</th>
              <th className="w-20 px-2 py-2 text-right font-mono-digital text-[9px] text-outline uppercase tracking-widest">BPM</th>
              <th className="w-24 px-2 py-2 text-center font-mono-digital text-[9px] text-outline uppercase tracking-widest" colSpan={3}>Time Sig</th>
              <th className="min-w-32 px-2 py-2 text-left font-mono-digital text-[9px] text-outline uppercase tracking-widest">Notes</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {rows.map((song, i) => {
                  if (!cellRefs.current[i]) cellRefs.current[i] = {}
                  return (
                    <SortableRow
                      key={song.id ?? song._tempId ?? i}
                      song={song}
                      index={i}
                      onUpdate={updateRow}
                      onDelete={deleteRow}
                      onKeyDown={handleKeyDown}
                      isNew={!song.id}
                      cellRefs={cellRefs.current}
                    />
                  )
                })}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* Footer */}
      <div className="relative border-t border-outline-variant/20 px-4 py-3 bg-surface-container-lowest">
        <div className="absolute bottom-2 left-2"><div className="v-screw" /></div>
        <div className="absolute bottom-2 right-2"><div className="v-screw" /></div>
        <button
          onClick={addRow}
          className="w-full py-2 border border-dashed border-outline-variant/40 hover:border-primary/40 text-outline hover:text-primary font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Row (or press Enter in last cell)
        </button>
      </div>
    </div>
  )
}
