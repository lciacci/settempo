# ADR-0001 — UUID primary keys

**Status:** accepted
**Date:** 2026-07-22 (backfilled; decision originally made in `afe2a4f`)

## Context

Dexie auto-increment (`++id`) allocates ids per device, starting at 1. Two
devices belonging to the same user therefore both produce `artist 1`,
`artist 2`, and so on. The Supabase schema keys rows on `(user_id, id)`, so
the phone's artist 1 and the laptop's artist 1 collided on push — last writer
won and the other device's record was overwritten.

The collision is structural: no sync-layer conflict resolution can fix it,
because the two rows are genuinely different records that happen to share a
primary key.

## Decision

Primary keys are string UUIDs generated client-side via `crypto.randomUUID()`,
exposed as `createId()` in `src/db/db.js`. Dexie stores declare `id` rather
than `++id`, so Dexie no longer generates keys — every insert goes through
`addRow()`, which supplies the UUID and the `createdAt` / `updatedAt` stamps.

## Consequences

**A pre-v3 local database cannot be migrated. It is dropped.**

IndexedDB does not permit altering an object store's `keyPath`, and Dexie
rejects the schema diff before running any upgrade callback:

```
UpgradeError: Not yet support for changing primary key
```

This was not understood when the decision was made. The change shipped with an
`.upgrade()` callback that remapped int ids to UUIDs and rewrote every foreign
key column. That callback could never execute. The result: on every browser
holding a v1/v2 database, `db.open()` failed, the Dexie instance stayed
permanently closed, and every subsequent call rejected with
`DatabaseClosedError`. Nothing caught it, so the app rendered its empty state
and looked healthy while being completely non-functional. Fresh browsers
worked, which made it present as "broken for some users."

The recovery, in `1872810`: `openDb()` catches the schema error, deletes the
database, clears both sync watermarks, and reopens empty — returning
`{ recovered: true }` so the UI can say so. **Anything a device had not yet
pushed to the backend is unrecoverable.**

Ongoing costs:

- Dexie assigns no ids. A bare `db.table.add(obj)` without an `id` throws.
  All inserts must route through `addRow()`.
- `crypto.randomUUID()` requires a secure context. The app must be served over
  HTTPS or from localhost; over plain HTTP every insert throws `TypeError`.
- Composite PK `(user_id, id)` remains in the backend schema, but now only for
  RLS scoping. It is no longer load-bearing for collision avoidance.

## Alternatives considered

**Server-assigned ids.** Rejected: the app is local-first and must create
records fully offline. A record with no id until it reaches a server is not
a local-first record.

**Namespacing int ids per device** (`{deviceId}:{seq}`). Would have avoided
collisions with a smaller key change, but still alters the primary key, so it
carries the identical un-migratable-upgrade problem. No cheaper.

**Keeping `++id` and reconciling on the server.** Rejected: the collision is
between two distinct records sharing a key, which the server cannot
disambiguate after the fact.

## What this ADR should have caught

The *Consequences* section is the one that matters, and answering "what
happens to databases that already exist?" honestly would have surfaced the
IndexedDB constraint before shipping rather than after. The migration path
for deployed state is now a required section, not an optional one.
