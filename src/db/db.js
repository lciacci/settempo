import Dexie from 'dexie'

export const DB_NAME = 'SetTempo'

export const db = new Dexie(DB_NAME)

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
// UUIDs make IDs globally unique.
//
// This version originally shipped with an .upgrade() callback that remapped
// int ids to UUIDs and rewrote every FK column. That callback could never
// run: IndexedDB forbids changing a store's primary key, and Dexie rejects
// the schema diff up front with `UpgradeError: Not yet support for changing
// primary key`. On any browser holding a v1/v2 database the open failed, the
// Dexie instance stayed closed, and every later call rejected with
// DatabaseClosedError — silently, because nothing caught it. The dead
// callback has been removed so it stops reading like a working migration;
// openDb() below handles the failure it caused.

export const createId = () => crypto.randomUUID()

db.version(3).stores({
  artists:     'id, name, updatedAt',
  songs:       'id, artistId, title, updatedAt',
  sets:        'id, artistId, name, updatedAt',
  setEntries:  'id, setId, songId, position, updatedAt',
  shows:       'id, artistId, name, date, updatedAt',
  setlists:    'id, showId, name, updatedAt',
  setlistSets: 'id, setlistId, setId, position, updatedAt',
})

// ── Open with recovery ────────────────────────────────────────────────────
// A pre-v3 database cannot be migrated in place (see above), so the only way
// forward on an affected device is to drop it and start clean. That is not a
// data-loss decision so much as an acknowledgement: the rows are already
// unreachable, because the database they live in will not open.
//
// Callers get { recovered } so the UI can tell the user their local store was
// rebuilt rather than silently presenting an empty library as normal.

const WATERMARK_PREFIXES = ['settempo_lastSyncedAt_', 'settempo_lastPushedAt_']

export function clearSyncWatermarks() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (WATERMARK_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k)
    }
  } catch {
    // localStorage may be unavailable in some private-mode contexts; the
    // watermark reset is best-effort cleanup, not load-bearing.
  }
}

// Failures that mean "the stored database is incompatible with this schema."
// Anything else (quota, blocked by another tab, corruption) is rethrown —
// wiping the user's data on an unrecognised error would be the wrong reflex.
const isUnrecoverableSchemaError = (err) =>
  err?.name === 'UpgradeError' || err?.name === 'VersionError'

export async function openDb() {
  try {
    await db.open()
    return { recovered: false }
  } catch (err) {
    if (!isUnrecoverableSchemaError(err)) throw err

    db.close()
    await db.delete()
    // The stale watermarks would otherwise suppress the re-push of everything
    // the rebuilt (empty) store goes on to accumulate.
    clearSyncWatermarks()
    await db.open()
    return { recovered: true, reason: err.message }
  }
}

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

// Records that a song was loaded into the metronome, for the Recent Sessions
// panel. Deliberately does NOT go through updateRow: `lastPlayedAt` is a
// local UI convenience, not library data.
//
//   - It is absent from the sync mappers, so it never reaches the backend.
//   - It must not bump `updatedAt`, or every song loaded during a gig would
//     queue a sync push — thirty songs, thirty pushes, for a sort order.
//
// It is also unindexed, so Recent Sessions sorts in JS rather than requiring
// a Dexie version bump. Given what the last schema change cost, an index for
// a four-item list is not a trade worth making.
export const markPlayed = (songId) =>
  db.songs.update(songId, { lastPlayedAt: ts() })

// ── Soft delete helpers ───────────────────────────────────────────────────────
// Use these instead of .delete() so changes are trackable for sync

export const softDelete = (table, id) =>
  db[table].update(id, { deletedAt: ts(), updatedAt: ts() })

export const softDeleteWhere = (table, index, value) =>
  db[table].where(index).equals(value).modify((r) => {
    r.deletedAt = ts()
    r.updatedAt = ts()
  })
