import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { openDb } from './db/db'
import { useAppStore } from './store/useAppStore'
import { describeError } from './lib/notify'

// Open the local store before mounting. A pre-v3 database cannot be migrated
// in place, so openDb() may rebuild it — the user is told either way rather
// than being shown an empty library as though it were normal.
openDb()
  .then(({ recovered }) => {
    if (recovered) {
      useAppStore.getState().notify(
        'LOCAL STORE REBUILT — PREVIOUS DATA COULD NOT BE MIGRATED',
        'error',
      )
    }
  })
  .catch((error) => {
    useAppStore.getState().notify(`LOCAL STORE OFFLINE · ${describeError(error)}`, 'error')
  })
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
