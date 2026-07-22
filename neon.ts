import { defineConfig } from '@neon/config/v1'

// SetTempo is a static PWA with no server tier, so the browser talks to
// Postgres through the Data API and Neon Auth issues the JWT that RLS scopes
// on. There is no place in this app to hold a connection string, which is why
// the serverless driver is deliberately not used.
export default defineConfig({
  auth: true,
  dataApi: true, // requires auth: true — the Data API verifies via Neon Auth
})
