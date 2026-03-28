import { useState, useCallback } from 'react'
import { runSync, getLastSyncedAt } from '../lib/sync'

export function useSyncEngine(session) {
  const userId = session?.user?.id

  const [syncState, setSyncState] = useState('idle') // 'idle' | 'syncing' | 'done' | 'error'
  const [syncedAt, setSyncedAt] = useState(null) // updated after each sync in this session
  const [syncError, setSyncError] = useState(null)

  // Prefer the in-session timestamp; fall back to the persisted value from localStorage.
  // Reading localStorage in render is acceptable — it's a fast synchronous read with no side effects.
  const lastSynced = syncedAt ?? (userId ? getLastSyncedAt(userId) || null : null)

  const sync = useCallback(async () => {
    if (!userId) return
    setSyncState('syncing')
    setSyncError(null)
    try {
      const ts = await runSync(userId)
      setSyncedAt(ts)
      setSyncState('done')
    } catch (e) {
      setSyncError(e.message)
      setSyncState('error')
    }
  }, [userId])

  return { sync, syncState, lastSynced, syncError }
}
