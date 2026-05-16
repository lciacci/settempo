import { describe, it, expect, beforeEach } from 'vitest'
import { db, addRow, updateRow, softDelete, createId } from '../db'

describe('createId', () => {
  it('returns a string', () => {
    expect(typeof createId()).toBe('string')
  })

  it('returns distinct values', () => {
    const ids = new Set(Array.from({ length: 50 }, createId))
    expect(ids.size).toBe(50)
  })
})

describe('addRow / updateRow / softDelete', () => {
  beforeEach(async () => {
    await Promise.all([
      db.artists.clear(),
      db.songs.clear(),
    ])
  })

  it('addRow fills id + createdAt + updatedAt', async () => {
    const id = await addRow('artists', { name: 'Beatles' })
    expect(typeof id).toBe('string')
    const row = await db.artists.get(id)
    expect(row.name).toBe('Beatles')
    expect(typeof row.createdAt).toBe('number')
    expect(typeof row.updatedAt).toBe('number')
  })

  it('addRow returns distinct ids across calls', async () => {
    const a = await addRow('artists', { name: 'A' })
    const b = await addRow('artists', { name: 'B' })
    expect(a).not.toBe(b)
  })

  it('updateRow bumps updatedAt', async () => {
    const id = await addRow('artists', { name: 'Beatles' })
    const before = (await db.artists.get(id)).updatedAt
    await new Promise((r) => setTimeout(r, 2))
    await updateRow('artists', id, { name: 'The Beatles' })
    const after = await db.artists.get(id)
    expect(after.name).toBe('The Beatles')
    expect(after.updatedAt).toBeGreaterThan(before)
  })

  it('softDelete sets deletedAt and bumps updatedAt', async () => {
    const id = await addRow('artists', { name: 'X' })
    const before = (await db.artists.get(id)).updatedAt
    await new Promise((r) => setTimeout(r, 2))
    await softDelete('artists', id)
    const after = await db.artists.get(id)
    expect(after.deletedAt).toBeGreaterThan(0)
    expect(after.updatedAt).toBeGreaterThan(before)
  })
})
