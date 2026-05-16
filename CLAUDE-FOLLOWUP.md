# Follow-up prompt — Dexie migration hardening

Paste the body below into Claude on the deploy machine to pick up where
the previous session left off. This file is temporary — delete after the
work ships.

---

## Prompt

I shipped a sync fix for settempo (lciacci/settempo on GitHub, `master`)
that switches Dexie primary keys from auto-increment int to UUID. It
works, but the v3 migration has a known booby-trap: Dexie 4 throws
`UpgradeError: Not yet support for changing primary key` when a device
opens the new build while still holding v2 data with `++id`. I had to
manually run a console recovery script on two devices to rescue local
data.

I want you to rewrite the migration so future devices don't need that
dance. The right shape, I think, is:

1. Keep Dexie's local primary key as `++id` (auto-increment int) — never
   change the keypath. This is the load-bearing decision that avoids the
   Dexie UpgradeError entirely.
2. Add a new `syncId` text column to every synced table, indexed.
   Populate it with `crypto.randomUUID()` on insert (via the `addRow`
   helper in `src/db/db.js`).
3. Sync layer (`src/lib/sync.js`) uses `syncId` — not the local `id` —
   as the Supabase row id. Mappers translate:
   - `toRemote(r)` writes Supabase `id = r.syncId`
   - `fromRemote(remote)` returns a local-shaped row whose `syncId =
     remote.id` and whose local `id` is either the existing local row's
     int id (looked up by `syncId`) or `undefined` so Dexie autoincrement
     assigns one on insert.
4. Foreign-key columns (`artistId`, `setId`, `songId`, `showId`,
   `setlistId`) need to be translated at sync time too — the FK value
   stored locally is the parent's int id, but the Supabase row needs the
   parent's `syncId` (and vice versa on pull). Build a syncId-by-localId
   map per parent table during push, and a localId-by-syncId map per
   parent table during pull.
5. Dexie schema bump:
   - `db.version(4)` — keep `++id` keypath on every store, add `syncId`
     to the index list, e.g. `'++id, name, syncId, updatedAt'`.
   - Upgrade callback: for each row, if `syncId` is missing, set
     `syncId = crypto.randomUUID()`. No keypath change. No FK rewrite.
     No data loss. No UpgradeError.
6. The existing v3 definition in `src/db/db.js` is the booby-trap.
   Delete it OR rewrite it to be the same no-op-keypath version as v4
   (and skip v4). The two devices currently in the wild are already past
   v3 with hand-recovered UUID rows; deleting v3 means they'll skip
   straight to v4 and pick up the syncId field on next open. Worth
   considering: keep v3 around but make it a no-op (just guarantee
   `syncId` exists, matching v4) so devices that crashed mid-upgrade
   don't get confused.

Plus a few smaller things while you're in there:

- Supabase `id` column stays `text` (already migrated). No schema change
  on the DB side.
- The `(user_id, id)` composite PK in Supabase is now over `(user_id,
  syncId)` semantically — no DB rename needed, just be aware the
  Supabase `id` is now `r.syncId` not `r.id`.
- Update the Supabase migration docs in `supabase-migration-uuid.sql`
  and `supabase-schema.sql` headers to reflect the new shape (column is
  still `id text` on Supabase; the change is purely on the client).
- Tests live in `src/lib/__tests__/sync-engine.test.js` and
  `src/db/__tests__/db-helpers.test.js`. Update them so `addRow` adds
  `syncId`, mappers translate via `syncId`, and FK translation works on
  push and pull. Add a Dexie v4 upgrade test if practical with
  fake-indexeddb.
- `runSync` semantics shouldn't change — same two watermarks, same
  push-then-pull order, same deletion reconcile. Only the mapping
  surface changes.
- Existing `dbAddRow` alias import in `src/components/SongGridView.jsx`
  stays — there's a local `addRow` UI helper there that shadows.

Context from the recovery session that informs the design:

- One device hit the UpgradeError mid-open, leaving DB at v20 with
  intact v2 data. The other device let Dexie's upgrade callback run
  (somehow — possibly older Dexie, or a different code path); rows
  technically survived but UI couldn't read them because the v3 schema
  recreated stores. Both were fixed by a console script that read v2
  rows, generated UUIDs, deleted+recreated stores at v30, re-inserted
  with FK remap.
- That console script proves the data shape works at v30 with `id` as
  primary key (text). So switching back to `++id` (int) for v4 is a
  deliberate ergonomic choice — Dexie locally autoincrement, sync layer
  UUID — not a forced retreat.
- Don't try to fix this by changing keypath again. Pick the additive
  path.

Work plan:

1. Branch from `master` (`fix/dexie-syncid` or similar).
2. Update `src/db/db.js` (schema, helpers, upgrade).
3. Update `src/lib/sync.js` (mappers + push/pull FK translation).
4. Update tests; add new ones for FK translation and v4 upgrade.
5. `npm run lint && npm test && npm run build` — all green before
   pushing.
6. Push branch, open PR, merge to `master`. (Don't deploy yet — I want
   to review the diff first; ping me when the PR is up.)

Drop the `CLAUDE-FOLLOWUP.md` file from the repo root in the same PR.
