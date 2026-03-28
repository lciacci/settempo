import Dexie from 'dexie'

export const db = new Dexie('SetTempo')

db.version(1).stores({
  artists:     '++id, name',
  songs:       '++id, artistId, title',
  sets:        '++id, artistId, name',
  setEntries:  '++id, setId, songId, position',
  shows:       '++id, artistId, name, date',
  setlists:    '++id, showId, name',
  setlistSets: '++id, setlistId, setId, position',
})

db.version(2).stores({
  artists:     '++id, name, userId, updatedAt',
  songs:       '++id, artistId, title, updatedAt',
  sets:        '++id, artistId, name, updatedAt',
  setEntries:  '++id, setId, songId, position, updatedAt',
  shows:       '++id, artistId, name, date, updatedAt',
  setlists:    '++id, showId, name, updatedAt',
  setlistSets: '++id, setlistId, setId, position, updatedAt',
}).upgrade(async (tx) => {
  const now = Date.now()
  const tableNames = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']
  for (const name of tableNames) {
    await tx.table(name).toCollection().modify((r) => {
      if (!r.createdAt) r.createdAt = now
      if (!r.updatedAt) r.updatedAt = r.createdAt ?? now
    })
  }
})

// ── Soft delete helpers ───────────────────────────────────────────────────────
// Use these instead of .delete() so changes are trackable for sync

const ts = () => Date.now()

export const softDelete = (table, id) =>
  db[table].update(id, { deletedAt: ts(), updatedAt: ts() })

export const softDeleteWhere = (table, index, value) =>
  db[table].where(index).equals(value).modify((r) => {
    r.deletedAt = ts()
    r.updatedAt = ts()
  })
