import { createClient } from '@neondatabase/neon-js'

// Neon client. Replaces the Supabase client; see ADR-0002.
//
// Both URLs are public by design. The Data API validates the session JWT that
// this client attaches automatically, and Postgres RLS scopes every row to
// auth.user_id(). No database credential exists in the browser — DATABASE_URL
// stays unprefixed in .env precisely so Vite cannot bake it into the bundle.

const authUrl = import.meta.env.VITE_NEON_AUTH_URL
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL

// Vite substitutes these at build time, so a missing value is a broken build
// rather than a runtime outage — but it fails at the first query with an
// opaque fetch error, which is exactly the silent failure this codebase has
// spent its history removing.
if (!authUrl || !dataApiUrl) {
  throw new Error(
    'Missing VITE_NEON_AUTH_URL or VITE_NEON_DATA_API_URL. ' +
    'Run `neon env pull`, then copy NEON_AUTH_BASE_URL and NEON_DATA_API_URL ' +
    'into VITE_-prefixed vars so Vite exposes them to the browser.',
  )
}

export const neon = createClient({
  auth: { url: authUrl },
  dataApi: { url: dataApiUrl },
})

// The rest of the app only ever needs { user: { id, email } }. Better Auth
// returns { user, session }; normalising here keeps App.jsx, AuthModal and
// useSyncEngine unchanged across the backend swap.
export const toSession = (data) =>
  data?.user ? { user: { id: data.user.id, email: data.user.email } } : null
