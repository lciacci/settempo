import { describe, it, expect, beforeEach } from 'vitest'
import { db, addRow, softDelete } from '../../db/db'
import { exportAllData, importData, validateBackup, BACKUP_TABLES } from '../backup'

const clearAll = () => Promise.all(BACKUP_TABLES.map((t) => db[t].clear()))

beforeEach(clearAll)

describe('validateBackup', () => {
  it('rejects anything that is not a backup object', () => {
    expect(() => validateBackup(null)).toThrow(/backup file/i)
    expect(() => validateBackup([])).toThrow(/backup file/i)
    expect(() => validateBackup({ unrelated: [] })).toThrow(/No SetTempo tables/i)
  })

  it('rejects an empty backup rather than treating it as a wipe instruction', () => {
    expect(() => validateBackup({ artists: [] })).toThrow(/no records/i)
  })

  it('rejects pre-UUID backups by name, not by crashing later', () => {
    expect(() => validateBackup({ artists: [{ id: 1, name: 'Old' }] }))
      .toThrow(/old numeric ids/i)
  })

  it('accepts a well-formed backup and counts it', () => {
    const result = validateBackup({
      artists: [{ id: 'a1', name: 'A' }],
      songs: [{ id: 's1', artistId: 'a1', title: 'T' }],
    })
    expect(result.rows).toBe(2)
    expect(result.tables).toEqual(['artists', 'songs'])
  })
})

describe('importData', () => {
  const good = {
    artists: [{ id: 'a1', name: 'Restored Artist' }],
    songs: [{ id: 's1', artistId: 'a1', title: 'Restored Song', bpm: 120 }],
  }

  it('preserves UUID ids, so foreign keys still resolve', async () => {
    await importData(good, 'add')
    const song = await db.songs.get('s1')
    expect(song.artistId).toBe('a1')
    expect(await db.artists.get('a1')).toBeTruthy()
  })

  it('stamps updatedAt so restored rows are visible to sync push', async () => {
    await importData(good, 'add')
    const song = await db.songs.get('s1')
    expect(typeof song.updatedAt).toBe('number')
    expect(song.updatedAt).toBeGreaterThan(0)
  })

  it('does NOT destroy the library when the file is bad', async () => {
    const keepId = await addRow('artists', { name: 'Must Survive' })

    // Replace mode + an invalid file: the old implementation cleared every
    // table before discovering the rows were unusable.
    await expect(importData({ artists: [{ id: 42 }] }, 'replace')).rejects.toThrow()

    expect(await db.artists.get(keepId)).toBeTruthy()
    expect(await db.artists.count()).toBe(1)
  })

  it('replace mode clears first, but only once the file is known good', async () => {
    await addRow('artists', { name: 'Will Be Replaced' })
    await importData(good, 'replace')

    const names = (await db.artists.toArray()).map((a) => a.name)
    expect(names).toEqual(['Restored Artist'])
  })
})

describe('exportAllData', () => {
  it('omits soft-deleted rows so a restore does not resurrect them', async () => {
    const keep = await addRow('artists', { name: 'Keep' })
    const drop = await addRow('artists', { name: 'Drop' })
    await softDelete('artists', drop)

    const data = await exportAllData(null)
    const ids = data.artists.map((a) => a.id)

    expect(ids).toContain(keep)
    expect(ids).not.toContain(drop)
  })

  it('round-trips: export then restore reproduces the library', async () => {
    const artistId = await addRow('artists', { name: 'Round Trip' })
    await addRow('songs', { artistId, title: 'Song A', bpm: 100 })
    await addRow('songs', { artistId, title: 'Song B', bpm: 140 })

    const snapshot = JSON.parse(JSON.stringify(await exportAllData(null)))
    await clearAll()
    await importData(snapshot, 'replace')

    expect(await db.artists.count()).toBe(1)
    const titles = (await db.songs.toArray()).map((s) => s.title).sort()
    expect(titles).toEqual(['Song A', 'Song B'])
    expect((await db.songs.toArray()).every((s) => s.artistId === artistId)).toBe(true)
  })
})
