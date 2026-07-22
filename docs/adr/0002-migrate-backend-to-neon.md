# ADR-0002 — Migrate the backend from Supabase to Neon

**Status:** proposed
**Date:** 2026-07-22

## Context

SetTempo's backend is Supabase, which supplies three distinct things: a
Postgres database, magic-link auth (`signInWithOtp`), and a browser-callable
PostgREST interface that `src/lib/sync.js` pushes and pulls through, with RLS
scoping rows per user.

Moving to Neon was initially assessed as a re-architecture, on the assumption
that Neon is Postgres-only and would leave auth and the browser REST layer
without replacements. **That assessment was wrong** and was corrected by
research on 2026-07-22.

## Decision

Migrate to Neon, replacing all three Supabase roles:

| Role | Supabase | Neon |
|---|---|---|
| Database | Supabase Postgres | Neon Postgres |
| Browser data access | PostgREST | Neon Data API (PostgREST-compatible) |
| Auth | `signInWithOtp` | Neon Auth (managed Better Auth), magic-link plugin |
| Client library | `@supabase/supabase-js` | `@neondatabase/neon-js` |

The Neon Data API is a PostgREST reimplementation built into Neon's proxy
fleet. It validates JWTs from any provider and enforces Postgres RLS.
`neon-js` exposes `createClient(...).from().select().eq()` — close enough to
`supabase-js` that `sync.js` should need little beyond an import swap.

## Consequences

- `src/lib/supabase.js` becomes a Neon client; env vars change.
- `src/hooks/useAuth.js` moves from `signInWithOtp` to Neon Auth's magic-link
  API. Session shape differs; `useSyncEngine` reads `session.user.id`.
- RLS policies port, but the JWT accessor changes: `auth.uid()` →
  `auth.user_id()` (reads the `sub` claim).
- Composite PK `(user_id, id)` stays valid.
- Dexie schema is untouched. UUID keys (ADR-0001) work against Neon
  unchanged, so no local migration is required — which matters, given
  ADR-0001's history.
- Data moves by dump and restore. UUID keys make this clean.
- **The Data API is Beta.** It is enabled per-branch for a single database
  and is incompatible with IP Allow / Private Networking.
- Neon Auth is free to 60K MAU; Neon free tier is 100 CU-hours/month and
  0.5 GB storage — far above this app's needs.
- Neon was acquired by Databricks in May 2025. Strategic risk for a project
  running on a free tier.

**Migration path for deployed state:** the user base is being reset
deliberately (see ADR-0001 — most local data was already unreachable), so no
production data migration is required. This ADR should be revisited if that
changes before the cutover.

## Alternatives considered

**Stay on Supabase.** The incumbent works. The migration is elective, driven
by preference rather than a defect.

**Neon for Postgres only, keep Supabase Auth.** Rejected: splits the stack
across two vendors and two billing relationships for no gain, now that Neon
Auth covers magic link natively.

**Neon Data API with a self-hosted auth layer.** Rejected as unnecessary work
given managed Better Auth exists; would also mean owning JWT issuance and
JWKS rotation.

## Verified 2026-07-22

- **`.upsert(rows, { onConflict })` is supported.** This was the open risk.
  `@neondatabase/postgrest-js` vendors `@supabase/postgrest-js`, so the query
  builder is the same library with an identical signature (`onConflict`,
  `ignoreDuplicates`, `count`, `defaultToNull`). `sync.js` needs an import and
  client swap, not a rewrite.
- **No credential reaches the browser.** `createClient()` takes a single
  public URL (`VITE_NEON_DATABASE_URL`) and derives the Auth and Data API
  endpoints from it. The session JWT is attached to every request
  automatically, which is what RLS scopes on.
- Neon's own agent onboarding proposes `@neondatabase/serverless` plus a
  `DATABASE_URL` in the environment. **That path is wrong for this app** and
  was deliberately rejected: SetTempo is a static PWA with no server tier, so
  there is nowhere safe to hold a connection string. Declared instead in
  `neon.ts` via `@neon/config` (`auth: true`, `dataApi: true`).
- Project: `delicate-snow-15340889` in org `org-dry-mode-76698079`, pg 18,
  aws-us-east-2. A duplicate project created during onboarding was deleted.

## Amended 2026-07-22 — Email OTP instead of magic link

The original decision said magic link, mirroring the Supabase behaviour. Changed to
Email OTP after the magic-link endpoint returned 404 (the plugin was never enabled)
and the trade-off was re-examined.

A magic link is a redirect flow. The user leaves the app, opens Mail, and taps a link
that iOS hands to **Safari — not to the installed standalone PWA**. They end up signed
in inside a browser tab while the app on their home screen is still signed out. SetTempo
is installable and its users are exactly the population who add it to a home screen, so
this is the common path, not the edge case.

Email OTP never leaves the app: the code is read and typed. The code input carries
`autocomplete="one-time-code"`, so iOS and Android offer it from the notification
without switching to Mail.

`useAuth` exposes `sendCode(email)` / `verifyCode(email, otp)` in place of
`signIn(email)`. `AuthModal` gained a code-entry step; a wrong code returns to that
step rather than to the start, so the email is not discarded.

Email OTP was already enabled on the Neon Auth instance; magic link was not. Endpoints
were probed directly rather than assumed — `/sign-in/magic-link` 404, both
`/email-otp/send-verification-otp` and `/sign-in/email-otp` live.

## Re-evaluate if

- The Data API leaves Beta with breaking changes, or stays Beta past the point
  of comfort
