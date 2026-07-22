import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { db, openDb } from './db/db'
import { useAppStore } from './store/useAppStore'
import { describeError } from './lib/notify'

const notify = (text, level) => useAppStore.getState().notify(text, level)

// Mount is idempotent: either the open settles or `blocked` fires first, and
// whichever happens first is the one that renders.
let mounted = false
function mount() {
  if (mounted) return
  mounted = true
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// IndexedDB will not upgrade or delete a database while another tab holds an
// older connection open, and it does not time out — it simply waits. Dexie's
// default `blocked` handler only console.warns, so the open promise would
// never settle and nothing would ever render. Mount anyway and name the fix,
// because the user is the only one who can resolve this.
db.on('blocked', () => {
  notify(
    'LOCAL STORE BLOCKED · ANOTHER TAB IS HOLDING AN OLDER VERSION — CLOSE IT AND RELOAD',
    'error',
  )
  mount()
})

// The inverse: another tab is upgrading and this connection is the stale one.
// Dexie's default handler already closes the connection to let that proceed;
// this only tells the user why their data went quiet.
db.on('versionchange', () => {
  notify('LOCAL STORE UPGRADED IN ANOTHER TAB · RELOAD TO CONTINUE', 'error')
})

// Open the local store before mounting. A pre-v3 database cannot be migrated
// in place, so openDb() may rebuild it — the user is told either way rather
// than being shown an empty library as though it were normal.
openDb()
  .then(({ recovered }) => {
    if (recovered) {
      notify('LOCAL STORE REBUILT — PREVIOUS DATA COULD NOT BE MIGRATED', 'error')
    }
  })
  .catch((error) => {
    notify(`LOCAL STORE OFFLINE · ${describeError(error)}`, 'error')
  })
  .finally(mount)
