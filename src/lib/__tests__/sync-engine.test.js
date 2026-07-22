import { describe, it, expect, beforeEach, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../neon', () => ({
  neon: { from },
}))

import { db, addRow, softDelete } from '../../db/db'
import { runSync, getLastPushedAt, getLastSyncedAt } from '../sync'

const userId = '00000000-0000-0000-0000-000000000000'

const stubRemote = ({ pullData = {}, captureUpsert = null } = {}) => {
  from.mockImplementation((tableName) => ({
    upsert: vi.fn((rows) => {
      if (captureUpsert) captureUpsert.push({ tableName, rows })
      return {
        select: vi.fn(() => Promise.resolve({
          data: rows.map((r) => ({ ...r, updated_at: r.updated_at ?? 5000 })),
          error: null,
        })),
      }
    }),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gt: vi.fn(() => Promise.resolve({
          data: pullData[tableName] ?? [], error: null,
        })),
      })),
    })),
  }))
}

describe('runSync', () => {
  beforeEach(async () => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k)
    await Promise.all([
      db.artists.clear(), db.songs.clear(), db.sets.clear(),
      db.setEntries.clear(), db.shows.clear(),
      db.setlists.clear(), db.setlistSets.clear(),
    ])
    from.mockReset()
  })

  it('push omits updated_at from payload and updates local updatedAt from server', async () => {
    const captured = []
    stubRemote({ captureUpsert: captured })

    const id = await addRow('artists', { name: 'Beatles' })
    await runSync(userId)

    const pushed = captured.find((c) => c.tableName === 'artists')
    expect(pushed).toBeDefined()
    expect(pushed.rows[0].id).toBe(id)
    expect('updated_at' in pushed.rows[0]).toBe(false)
    expect(pushed.rows[0].name).toBe('Beatles')

    const local = await db.artists.get(id)
    expect(local.updatedAt).toBe(5000)
  })

  it('pull hard-deletes rows whose remote has deleted_at set', async () => {
    const id = await addRow('artists', { name: 'Doomed' })
    // Disable push of the row by setting lastPushedAt far in the future.
    localStorage.setItem(`settempo_lastPushedAt_${userId}`, String(Date.now() + 10_000_000))

    stubRemote({
      pullData: {
        artists: [{
          id, user_id: userId, name: 'Doomed',
          created_at: 1, updated_at: 2000, deleted_at: 2000,
        }],
      },
    })

    await runSync(userId)
    const row = await db.artists.get(id)
    expect(row).toBeUndefined()
  })

  it('watermarks are split: lastPushedAt is local, lastSyncedAt is server-driven', async () => {
    stubRemote({
      pullData: {
        songs: [{
          id: 'remote-song', user_id: userId, artist_id: 'a',
          title: 'X', bpm: 120, time_sig_n: 4, time_sig_d: 4, notes: null,
          created_at: 1, updated_at: 8888, deleted_at: null,
        }],
      },
    })

    await addRow('artists', { name: 'A' })
    const before = Date.now()
    await runSync(userId)
    const after = Date.now()

    expect(getLastSyncedAt(userId)).toBe(8888)
    const pushed = getLastPushedAt(userId)
    expect(pushed).toBeGreaterThanOrEqual(before)
    expect(pushed).toBeLessThanOrEqual(after)
  })

  it('soft-deleted local row is included in push payload', async () => {
    const captured = []
    stubRemote({ captureUpsert: captured })

    const id = await addRow('artists', { name: 'Gone' })
    await softDelete('artists', id)
    await runSync(userId)

    const pushed = captured.find((c) => c.tableName === 'artists')
    expect(pushed.rows[0].deleted_at).toBeGreaterThan(0)
  })
})
