import { db } from '../db/db'
import { supabase } from './supabase'

// ── Persistence ────────────────────────────────────────────────────────────

const storageKey = (userId) => `settempo_lastSyncedAt_${userId}`

export const getLastSyncedAt = (userId) =>
  Number(localStorage.getItem(storageKey(userId))) || 0

const saveLastSyncedAt = (userId, ts) =>
  localStorage.setItem(storageKey(userId), String(ts))

// ── Column mappers (camelCase ↔ snake_case) ───────────────────────────────

const mappers = {
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

const SUPABASE_TABLE = {
  artists:     'artists',
  songs:       'songs',
  sets:        'sets',
  setEntries:  'set_entries',
  shows:       'shows',
  setlists:    'setlists',
  setlistSets: 'setlist_sets',
}

const TABLE_ORDER = ['artists', 'songs', 'sets', 'setEntries', 'shows', 'setlists', 'setlistSets']

// ── Push: local → remote ──────────────────────────────────────────────────

async function push(userId, lastSyncedAt) {
  for (const table of TABLE_ORDER) {
    const records = await db[table].filter((r) => r.updatedAt > lastSyncedAt).toArray()
    if (!records.length) continue

    const rows = records.map((r) => mappers[table].toRemote(r, userId))
    const { error } = await supabase
      .from(SUPABASE_TABLE[table])
      .upsert(rows, { onConflict: 'user_id,id' })
    if (error) throw new Error(`Push ${table}: ${error.message}`)
  }
}

// ── Pull: remote → local ──────────────────────────────────────────────────

async function pull(userId, lastSyncedAt) {
  for (const table of TABLE_ORDER) {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE[table])
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSyncedAt)
    if (error) throw new Error(`Pull ${table}: ${error.message}`)
    if (!data?.length) continue

    await db.transaction('rw', db[table], async () => {
      for (const row of data) {
        const remote = mappers[table].fromRemote(row)
        const local = await db[table].get(remote.id)
        if (!local || remote.updatedAt > local.updatedAt) {
          await db[table].put(remote)
        }
      }
    })
  }
}

// ── Public entry point ────────────────────────────────────────────────────

export async function runSync(userId) {
  // Capture start time before sync so any modifications during the window
  // are picked up on the next sync rather than silently dropped.
  const syncStartedAt = Date.now()
  const lastSyncedAt = getLastSyncedAt(userId)

  await push(userId, lastSyncedAt)
  await pull(userId, lastSyncedAt)

  saveLastSyncedAt(userId, syncStartedAt)
  return syncStartedAt
}
