import { db } from '../db/db'

// Snapshot export / restore. Lives here rather than in Settings.jsx because
// it is data-layer logic that needs testing without mounting a component.

export const BACKUP_TABLES = [
  'artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets',
]

// Tombstones are a sync-layer concern. A backup is a snapshot of the library
// as the user sees it, so soft-deleted rows are dropped rather than carried
// into the file and resurrected on restore.
const live = (rows) => (rows ?? []).filter((r) => !r.deletedAt)

export async function exportAllData(artistId) {
  const data = {}

  for (const table of BACKUP_TABLES) {
    if (artistId && table === 'artists') {
      data[table] = [await db.artists.get(artistId)].filter(Boolean)
    } else if (artistId && ['songs', 'sets', 'shows'].includes(table)) {
      data[table] = await db[table].where('artistId').equals(artistId).toArray()
    } else {
      data[table] = await db[table].toArray()
    }
  }

  if (artistId) {
    const setIds = new Set(data.sets.map((s) => s.id))
    const showIds = new Set(data.shows.map((s) => s.id))

    data.setEntries = (await db.setEntries.toArray()).filter((e) => setIds.has(e.setId))
    data.setlists = (await db.setlists.toArray()).filter((sl) => showIds.has(sl.showId))
    const setlistIds = new Set(data.setlists.map((sl) => sl.id))
    data.setlistSets = (await db.setlistSets.toArray()).filter((ss) => setlistIds.has(ss.setlistId))
  }

  for (const table of BACKUP_TABLES) data[table] = live(data[table])
  return data
}

// Validate before touching the database. The previous implementation cleared
// every table *first* and only then discovered the rows were unusable, so a
// bad file destroyed the library and restored nothing.
export function validateBackup(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json))
    throw new Error('Not a SetTempo backup file')

  const tables = BACKUP_TABLES.filter((t) => Array.isArray(json[t]))
  if (!tables.length)
    throw new Error('No SetTempo tables found — is this the right file?')

  let rows = 0
  for (const table of tables) {
    for (const row of json[table]) {
      if (!row || typeof row !== 'object')
        throw new Error(`Malformed row in "${table}"`)
      if (typeof row.id !== 'string' || !row.id)
        throw new Error(
          `"${table}" uses old numeric ids — backups from before the UUID change cannot be restored`,
        )
      rows += 1
    }
  }
  if (!rows) throw new Error('Backup contains no records')
  return { tables, rows }
}

// Ids are UUIDs and therefore globally unique, so they are preserved rather
// than reassigned — which also means foreign keys need no remapping. The old
// remap logic existed only because per-device auto-increment ids collided.
export async function importData(json, mode) {
  const { tables, rows } = validateBackup(json)
  const now = Date.now()

  // One transaction across every table: a failure part-way through rolls the
  // whole thing back rather than leaving a half-written library that the sync
  // layer would then try to push.
  await db.transaction('rw', BACKUP_TABLES.map((t) => db[t]), async () => {
    if (mode === 'replace') {
      for (const table of BACKUP_TABLES) await db[table].clear()
    }
    for (const table of tables) {
      for (const row of json[table]) {
        await db[table].put({
          ...row,
          createdAt: row.createdAt ?? now,
          // Stamp on write: a restored row is a local change the backend has
          // not seen. Without this the push filter skips it forever.
          updatedAt: now,
        })
      }
    }
  })

  return { tables: tables.length, rows }
}
