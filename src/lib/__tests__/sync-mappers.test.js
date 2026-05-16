import { describe, it, expect } from 'vitest'
import { mappers, TABLE_ORDER, SUPABASE_TABLE } from '../sync'

const userId = 'user-abc'

const samples = {
  artists: {
    id: 'a1', name: 'Beatles',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  songs: {
    id: 's1', artistId: 'a1', title: 'Hey Jude', bpm: 73,
    timeSigN: 4, timeSigD: 4, notes: 'na',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  sets: {
    id: 'set1', artistId: 'a1', name: 'Encore',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  setEntries: {
    id: 'se1', setId: 'set1', songId: 's1', position: 0,
    bpmOverride: 80, timeSigNOverride: 3, timeSigDOverride: 4, notesOverride: 'softer',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  shows: {
    id: 'sh1', artistId: 'a1', name: 'Apollo', date: '2026-05-16',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  setlists: {
    id: 'sl1', showId: 'sh1', name: 'Main',
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
  setlistSets: {
    id: 'ss1', setlistId: 'sl1', setId: 'set1', position: 0, isLocalCopy: false,
    createdAt: 1, updatedAt: 2, deletedAt: null,
  },
}

describe('sync mappers', () => {
  it('cover every table in TABLE_ORDER', () => {
    for (const t of TABLE_ORDER) {
      expect(mappers[t]).toBeDefined()
      expect(SUPABASE_TABLE[t]).toBeDefined()
    }
  })

  for (const table of Object.keys(samples)) {
    it(`${table}: toRemote → fromRemote round-trips`, () => {
      const local = samples[table]
      const remote = mappers[table].toRemote(local, userId)
      expect(remote.user_id).toBe(userId)
      const back = mappers[table].fromRemote(remote)
      expect(back).toEqual(local)
    })

    it(`${table}: toRemote uses snake_case keys`, () => {
      const remote = mappers[table].toRemote(samples[table], userId)
      for (const k of Object.keys(remote)) {
        expect(k).toMatch(/^[a-z0-9_]+$/)
      }
    })
  }

  it('setlistSets default isLocalCopy false on fromRemote when missing', () => {
    const back = mappers.setlistSets.fromRemote({
      id: 'x', setlist_id: 'a', set_id: 'b', position: 0,
      created_at: 1, updated_at: 2, deleted_at: null,
    })
    expect(back.isLocalCopy).toBe(false)
  })
})
