import { db } from '../db/db'
import { neon } from './neon'

// ── Persistence ────────────────────────────────────────────────────────────
//
// Two watermarks per user:
//
//   lastPushedAt   local clock ms — captures "when did we last attempt to
//                  push." Local push filter selects rows whose locally-set
//                  updatedAt is newer than this. Local clock is fine for
//                  the local-changed-since check.
//
//   lastSyncedAt   server clock ms — max updated_at we've ever seen come
//                  back from Supabase. Pull filter uses this so cross-device
//                  clock skew can't make us miss or duplicate rows.
//
// The previous single-watermark design mixed both, so a phone with a clock
// ahead of the laptop could persistently skip rows the laptop wrote.

const pushedKey  = (userId) => `settempo_lastPushedAt_${userId}`
const syncedKey  = (userId) => `settempo_lastSyncedAt_${userId}`

export const getLastPushedAt = (userId) =>
  Number(localStorage.getItem(pushedKey(userId))) || 0
export const getLastSyncedAt = (userId) =>
  Number(localStorage.getItem(syncedKey(userId))) || 0

const saveLastPushedAt = (userId, ts) =>
  localStorage.setItem(pushedKey(userId), String(ts))
const saveLastSyncedAt = (userId, ts) =>
  localStorage.setItem(syncedKey(userId), String(ts))

// ── Column mappers (camelCase ↔ snake_case) ───────────────────────────────

export const mappers = {
  artists: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      name: r.name,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, name: r.name,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  songs: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      artist_id: r.artistId, title: r.title, bpm: r.bpm,
      time_sig_n: r.timeSigN, time_sig_d: r.timeSigD, notes: r.notes ?? null,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, artistId: r.artist_id, title: r.title, bpm: r.bpm,
      timeSigN: r.time_sig_n, timeSigD: r.time_sig_d, notes: r.notes ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  sets: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      artist_id: r.artistId, name: r.name,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, artistId: r.artist_id, name: r.name,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  setEntries: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      set_id: r.setId, song_id: r.songId, position: r.position,
      bpm_override: r.bpmOverride ?? null,
      time_sig_n_override: r.timeSigNOverride ?? null,
      time_sig_d_override: r.timeSigDOverride ?? null,
      notes_override: r.notesOverride ?? null,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, setId: r.set_id, songId: r.song_id, position: r.position,
      bpmOverride: r.bpm_override ?? null,
      timeSigNOverride: r.time_sig_n_override ?? null,
      timeSigDOverride: r.time_sig_d_override ?? null,
      notesOverride: r.notes_override ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  shows: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      artist_id: r.artistId, name: r.name, date: r.date ?? null,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, artistId: r.artist_id, name: r.name, date: r.date ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  setlists: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      show_id: r.showId, name: r.name,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, showId: r.show_id, name: r.name,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
  setlistSets: {
    toRemote: (r, userId) => ({
      id: r.id, user_id: userId,
      setlist_id: r.setlistId, set_id: r.setId, position: r.position,
      is_local_copy: r.isLocalCopy ?? false,
      created_at: r.createdAt, updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null,
    }),
    fromRemote: (r) => ({
      id: r.id, setlistId: r.setlist_id, setId: r.set_id, position: r.position,
      isLocalCopy: r.is_local_copy ?? false,
      createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
    }),
  },
}

export const REMOTE_TABLE = {
  artists:     'artists',
  songs:       'songs',
  sets:        'sets',
  setEntries:  'set_entries',
  shows:       'shows',
  setlists:    'setlists',
  setlistSets: 'setlist_sets',
}

export const TABLE_ORDER = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']

// Server-stamped updated_at: we strip the client's value from the push
// payload, and a Postgres trigger fills it from clock_timestamp(). The
// upsert .select() returns the server's authoritative timestamp, which we
// write back into Dexie so the next push filter is consistent with what
// the server has on record.
const stripUpdatedAt = (row) => {
  const { updated_at, ...rest } = row // eslint-disable-line no-unused-vars
  return rest
}

// ── Push: local → remote ──────────────────────────────────────────────────

async function push(userId, lastPushedAt) {
  for (const table of TABLE_ORDER) {
    const records = await db[table].filter((r) => r.updatedAt > lastPushedAt).toArray()
    if (!records.length) continue

    const rows = records.map((r) => stripUpdatedAt(mappers[table].toRemote(r, userId)))
    const { data, error } = await neon
      .from(REMOTE_TABLE[table])
      .upsert(rows, { onConflict: 'user_id,id' })
      .select()
    if (error) throw new Error(`Push ${table}: ${error.message}`)

    // Reconcile local updatedAt to the server's authoritative timestamp so
    // future push filters don't re-send rows the server has already
    // accepted (clock skew would otherwise cause repeat work).
    if (data?.length) {
      await db.transaction('rw', db[table], async () => {
        for (const row of data) {
          const remote = mappers[table].fromRemote(row)
          await db[table].update(remote.id, { updatedAt: remote.updatedAt })
        }
      })
    }
  }
}

// ── Pull: remote → local ──────────────────────────────────────────────────

async function pull(userId, lastSyncedAt) {
  let maxServerTs = lastSyncedAt
  for (const table of TABLE_ORDER) {
    const { data, error } = await neon
      .from(REMOTE_TABLE[table])
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSyncedAt)
    if (error) throw new Error(`Pull ${table}: ${error.message}`)
    if (!data?.length) continue

    await db.transaction('rw', db[table], async () => {
      for (const row of data) {
        const remote = mappers[table].fromRemote(row)
        if (remote.updatedAt > maxServerTs) maxServerTs = remote.updatedAt

        if (remote.deletedAt != null) {
          // Remote says this row is deleted — hard-delete locally so the
          // UI sees it gone immediately and we don't keep tombstones
          // around forever.
          await db[table].delete(remote.id)
          continue
        }

        const local = await db[table].get(remote.id)
        if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
          await db[table].put(remote)
        }
      }
    })
  }
  return maxServerTs
}

// ── Public entry point ────────────────────────────────────────────────────

export async function runSync(userId) {
  // Snapshot before push so any local writes during the push window are
  // picked up on the next sync rather than silently dropped.
  const pushStartedAt = Date.now()
  const lastPushedAt = getLastPushedAt(userId)
  const lastSyncedAt = getLastSyncedAt(userId)

  await push(userId, lastPushedAt)
  const maxServerTs = await pull(userId, lastSyncedAt)

  saveLastPushedAt(userId, pushStartedAt)
  if (maxServerTs > lastSyncedAt) saveLastSyncedAt(userId, maxServerTs)
  return pushStartedAt
}
