import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'

// Regression cover for the v3 migration failure.
//
// The v3 schema changed every table's primary key from `++id` to `id`.
// IndexedDB does not allow that, so Dexie rejects the open outright and the
// instance stays permanently closed. Every existing test built a *fresh* v3
// database, which is why the suite stayed green while the app was bricked on
// any device that had run an earlier build.
//
// These tests seed a genuine legacy database first, then exercise the real
// open path.

const DB_NAME = 'SetTempo'

// The v1/v2 schema exactly as it shipped, so the seeded database is the one
// real users actually hold.
async function seedLegacyDatabase() {
  const legacy = new Dexie(DB_NAME)
  legacy.version(1).stores({
    artists:     '++id, name',
    songs:       '++id, artistId, title',
    sets:        '++id, artistId, name',
    setEntries:  '++id, setId, songId, position',
    shows:       '++id, artistId, name, date',
    setlists:    '++id, showId, name',
    setlistSets: '++id, setlistId, setId, position',
  })
  legacy.version(2).stores({
    artists:     '++id, name, userId, updatedAt',
    songs:       '++id, artistId, title, updatedAt',
    sets:        '++id, artistId, name, updatedAt',
    setEntries:  '++id, setId, songId, position, updatedAt',
    shows:       '++id, artistId, name, date, updatedAt',
    setlists:    '++id, showId, name, updatedAt',
    setlistSets: '++id, setlistId, setId, position, updatedAt',
  })
  await legacy.open()
  const artistId = await legacy.artists.add({ name: 'Legacy Artist', createdAt: 1, updatedAt: 1 })
  await legacy.songs.add({ artistId, title: 'Legacy Song', bpm: 120, createdAt: 1, updatedAt: 1 })
  legacy.close()
}

describe('openDb recovery from the un-migratable v3 schema change', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
    localStorage.clear()
  })

  it('recovers a pre-v3 database instead of failing closed', async () => {
    await seedLegacyDatabase()

    const { openDb, db } = await import('../db')
    const result = await openDb()

    expect(result.recovered).toBe(true)
    expect(db.isOpen()).toBe(true)
  })

  it('accepts writes after recovery — the Initialize path', async () => {
    await seedLegacyDatabase()

    const { openDb, db, addRow } = await import('../db')
    await openDb()

    // This is what clicking Initialize on the Library Archive screen does.
    const id = await addRow('artists', { name: 'Initialized After Recovery' })
    const row = await db.artists.get(id)

    expect(row.name).toBe('Initialized After Recovery')
    expect(typeof row.updatedAt).toBe('number')
  })

  it('clears stale sync watermarks so the rebuilt store re-pushes', async () => {
    await seedLegacyDatabase()
    localStorage.setItem('settempo_lastSyncedAt_user-1', '1750000000000')
    localStorage.setItem('settempo_lastPushedAt_user-1', '1750000000000')
    localStorage.setItem('settempo_unrelated_setting', 'keep-me')

    const { openDb } = await import('../db')
    await openDb()

    expect(localStorage.getItem('settempo_lastSyncedAt_user-1')).toBeNull()
    expect(localStorage.getItem('settempo_lastPushedAt_user-1')).toBeNull()
    // Recovery is targeted: unrelated settings survive.
    expect(localStorage.getItem('settempo_unrelated_setting')).toBe('keep-me')
  })

  it('reports recovered: false when there is nothing to recover', async () => {
    const { openDb } = await import('../db')
    const result = await openDb()

    expect(result.recovered).toBe(false)
  })
})
