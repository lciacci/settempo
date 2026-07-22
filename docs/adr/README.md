# Architecture Decision Records

## When to write one

**Only for decisions that are expensive to reverse.** The test is not "was this
important" — it is "if this turns out wrong in six months, what does undoing it
cost?"

Write an ADR for:

- Data model shape and primary key strategy
- Sync semantics (conflict resolution, watermarks, delete behaviour)
- Auth mechanism
- Backend / hosting choice

Do not write one for:

- UI structure, component layout, styling
- Library picks that a `git revert` undoes cleanly
- Anything already legible from the code plus `CLAUDE.md`

A solo project that writes an ADR per pull request stops writing them by
number six, and stale decision records are worse than none — they mislead
with authority. Fewer, and kept current.

## Why this exists

SetTempo shipped a change (`afe2a4f`) switching every primary key from
auto-increment ints to UUIDs. IndexedDB forbids altering a store's primary
key, so every browser holding an existing database failed to open and every
write silently rejected. The app was non-functional for every existing user
until `1872810`.

That was not a coding error. The migration code was carefully written — it
simply could never run. The gap was that nobody had to write down what the
decision cost before making it. A *Consequences* section forces that question.

See [ADR-0001](0001-uuid-primary-keys.md).

## Format

One file per decision: `NNNN-short-slug.md`, four-digit sequential.

```markdown
# ADR-NNNN — Title

**Status:** proposed | accepted | superseded by ADR-NNNN
**Date:** YYYY-MM-DD

## Context
What forced a decision. The constraint, not the solution.

## Decision
What was chosen, stated plainly.

## Consequences
What this costs, including what becomes hard or impossible. Migration path
for anything already deployed. **This is the section that earns the ADR** —
if it only lists benefits, it is not finished.

## Alternatives considered
What else was on the table and why it lost.
```

Status moves `proposed` → `accepted` when the change lands. Superseded ADRs
stay in place with a pointer; deleting them loses the reasoning trail.
