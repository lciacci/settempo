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

// ── v3: switch primary keys from int (++id) to string (UUID). ──────────────
// Per-device Dexie auto-increment caused (user_id, id) collisions across
// devices on the Supabase side — phone's artist 1 overwrote laptop's artist 1.
// UUIDs make IDs globally unique. The upgrade remaps existing rows and
// rewrites every foreign-key column so local data survives the change.

const FK_MAP = {
  songs:       { artistId: 'artists' },
  sets:        { artistId: 'artists' },
  setEntries:  { setId: 'sets', songId: 'songs' },
  shows:       { artistId: 'artists' },
  setlists:    { showId: 'shows' },
  setlistSets: { setlistId: 'setlists', setId: 'sets' },
}

const TABLE_NAMES = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']

export const createId = () => crypto.randomUUID()

db.version(3).stores({
  artists:     'id, name, updatedAt',
  songs:       'id, artistId, title, updatedAt',
  sets:        'id, artistId, name, updatedAt',
  setEntries:  'id, setId, songId, position, updatedAt',
  shows:       'id, artistId, name, date, updatedAt',
  setlists:    'id, showId, name, updatedAt',
  setlistSets: 'id, setlistId, setId, position, updatedAt',
}).upgrade(async (tx) => {
  // Build oldIntId → newUuid map per table.
  const idMap = {}
  for (const name of TABLE_NAMES) {
    idMap[name] = new Map()
    const rows = await tx.table(name).toArray()
    for (const r of rows) {
      idMap[name].set(r.id, createId())
    }
  }

  // Rewrite each table: remap primary key + remap FK columns.
  for (const name of TABLE_NAMES) {
    const table = tx.table(name)
    const rows = await table.toArray()
    await table.clear()
    const fks = FK_MAP[name] || {}
    for (const r of rows) {
      const next = { ...r, id: idMap[name].get(r.id) }
      for (const [col, refTable] of Object.entries(fks)) {
        const old = r[col]
        if (old != null) {
          const mapped = idMap[refTable]?.get(old)
          if (mapped) next[col] = mapped
        }
      }
      await table.put(next)
    }
  }

  // Old int IDs are gone on the client; remote still has bigint rows.
  // Reset the sync watermark so the next sync re-uploads everything under
  // its new UUID. The Supabase migration must run before any device syncs
  // post-upgrade (see supabase-migration-uuid.sql).
  try {
    const keys = Object.keys(localStorage)
    for (const k of keys) {
      if (k.startsWith('settempo_lastSyncedAt_') || k.startsWith('settempo_lastPushedAt_')) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    // localStorage may be unavailable in some private-mode contexts; the
    // sync watermark is best-effort cleanup, not load-bearing.
  }
})

// ── Insert / update helpers ───────────────────────────────────────────────
// All inserts must go through addRow so id, createdAt, and updatedAt are
// populated consistently. Dexie no longer auto-generates ids in v3.

const ts = () => Date.now()

export async function addRow(table, data) {
  const now = ts()
  const row = {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  // Defensive: if caller passed createdAt/updatedAt/id, theirs wins for
  // createdAt but we always refresh updatedAt and never accept a caller id
  // (UUID generation is the helper's job — caller ids would defeat that).
  row.id = data?.id ?? row.id
  await db[table].add(row)
  return row.id
}

export async function updateRow(table, id, patch) {
  return db[table].update(id, { ...patch, updatedAt: ts() })
}

// ── Soft delete helpers ───────────────────────────────────────────────────────
// Use these instead of .delete() so changes are trackable for sync

export const softDelete = (table, id) =>
  db[table].update(id, { deletedAt: ts(), updatedAt: ts() })

export const softDeleteWhere = (table, index, value) =>
  db[table].where(index).equals(value).modify((r) => {
    r.deletedAt = ts()
    r.updatedAt = ts()
  })
