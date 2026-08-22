#!/usr/bin/env python3
"""`restore_offered` — the HARNESS side of the restore receipt (T2, ADR-0015).

    python3 scripts/restore/offer.py            # called from mnemos-session-start.sh

── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────────────────

`restore_injected` is a log line the hook wrote **about itself**. The log showed four;
the model received nothing on all four, because a PreToolUse hook's stdout went to the
debug log. Thirty-seven days of trial evidence was one party certifying its own delivery.

So T2 splits sender from receiver, and this is the sender:

    restore_offered   written by the HARNESS   "I delivered N bytes, these fields"
    restore_receipt   written by the MODEL     "what arrived, what I had to re-derive"
    restore/scan.py   diffs them at Stop       exit 2 on an unanswered offer

Neither party can certify itself. An offer with no receipt is a **detected** miss — the
one thing the old design could never see, because nothing independent recorded that a
restore was owed.

This records only what is mechanically true (bytes, fields present). It makes NO claim
about delivery — that is precisely the claim it is not entitled to make.

── `--delivered-stdin`: THE SECOND EVENT, AND WHY IT IS A SECOND EVENT ───────────────

    ... | python3 scripts/restore/offer.py --delivered-stdin   # end of mnemos-session-start.sh

P3 has never measured what it claims to measure. It asks **deliverability** and has only
ever had proxies for it — three anchors, three wrong (12,000 from an upper bound; 9,500,
refuted by a checkpoint at exactly that size producing 10,230 chars; 8,000, safe today by
margin only). The delivered thing is *characters of hook stdout* against a documented
10,000-character cap; the measured thing was *checkpoint JSON bytes*. Rendering the last
120 archived checkpoints put the render/JSON ratio at 0.839–0.937 and P3's false-alarm
rate at **31 of 62 firings**. A fourth constant would be a fourth guess.

So the hook counts what it actually wrote and reports it here.

**The observatory scoped this as a third field on `restore_offered` and it cannot be
one.** That event is the OBLIGATION — `scan.py` keys on it, and an offer that goes
unwritten reads as "nothing was owed", silently disabling T2 for that session. The total
is not known until the hook's last line (the iCPG block, ~1,037 chars, is emitted after
the restore block; it is the exact overhead the 9,500 anchor missed). Moving the
obligation to the last line to carry one more field would put the load-bearing record
behind every failure mode of the rest of the hook.

Two events instead, and the asymmetry is the design:

    restore_offered    written the moment the restore prints   an obligation, never at risk
    restore_delivered  written on the hook's last line         a measurement, may be lost

**If the measurement is lost, that is VISIBLE** — an offer with no delivered event — and
P3 reports the shortfall rather than assuming coverage. Losing the obligation would have
been invisible, which is the failure the whole T2 design exists to prevent. Neither event
is entitled to the other's claim, the same rule that split sender from receiver above.

This still does NOT settle the budget. It records last run's delivered size; it predicts
nothing about the next, and it is silent on T2 sufficiency. Re-anchoring `RESTORE_BUDGET_BYTES`
on this data is a decision for whoever reads enough of it — deliberately not taken here.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

try:
    from . import paths
except ImportError:  # run as a loose script — no package context
    import paths

# Mirrors bin/tessera-watch RESTORE_REQUIRED_FIELDS (P3/T1). Kept as a literal rather
# than imported: tessera-watch is a script, not a module, and this must never fail to
# record because an import moved.
CHECKPOINT_FIELDS = ("goal", "active_constraints", "task_narrative")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def build_offer(checkpoint: dict, size: int, *, session_id: str, ts: str | None = None) -> dict:
    """Mechanically-true facts only. No claim that any of it reached a model."""
    return {
        "type": "restore_offered",
        "ts": ts or _utc_now_iso(),
        "session_id": session_id,
        "source": "mnemos-session-start",
        "data": {
            "bytes": size,
            "fields": [f for f in CHECKPOINT_FIELDS if checkpoint.get(f)],
            "goal_chars": len(checkpoint.get("goal") or ""),
        },
    }


def build_delivered(raw: bytes, *, session_id: str, ts: str | None = None) -> dict:
    """What the hook actually wrote to stdout. A measurement, not an obligation.

    BOTH UNITS, because we do not know which one the cap counts. The limit is documented
    as "10,000 characters" and the harness's implementation is not ours to read; this
    hook's own output differs by 55 between the two (5,943 chars / 5,998 bytes — em
    dashes), about 1%. Recording one unit and inferring the other is how P3 got three
    wrong anchors, and the cost of recording both is eight bytes per session.

    COUNTED HERE RATHER THAN IN THE SHELL, and that is the point of taking BYTES instead of
    a number. Bash's `${#var}` counts CHARACTERS under a UTF-8 locale and BYTES under
    `LC_ALL=C` — so the unit of a shell-side count is set by ambient environment the hook
    does not control, and a hook runs under whatever the harness hands it. That is the
    same class as F-001's interpreter: a value resolved through mutable ambient state.

    **AND MOVING IT TO PYTHON DID NOT FIX THAT — it relocated it one layer.** This docstring
    said "Python's decode is deterministic, so the unit is a property of this file", which was
    false: `sys.stdin.read()` decodes with the AMBIENT LOCALE encoding. Measured under
    `LC_ALL=en_US.ISO8859-1`, a 3-char/5-byte payload recorded as **5 chars / 8 bytes** —
    both units silently wrong, fed straight into a comparison against a 10,000-char cap. Under
    `LC_ALL=C` stdin decodes with surrogateescape and the `text.encode("utf-8")` below raised
    `UnicodeEncodeError`, outside the handler, so the "designed fail-open" was happening by
    the hook's `|| true` rather than by design. Found by review round 3, in the paragraph
    claiming the hazard had been removed. The caller reads bytes and decodes them explicitly
    (`sys.stdin.buffer`, `errors="replace"`), which is what actually makes the unit a property
    of this file.
    """
    return {
        "type": "restore_delivered",
        "ts": ts or _utc_now_iso(),
        "session_id": session_id,
        "source": "mnemos-session-start",
        # BOTH UNITS FROM THE BYTES, neither inferred from the other. This took `text` and
        # computed `len(text.encode("utf-8"))` — but `text` came from a LOSSY decode, so every
        # non-UTF-8 byte on the hook's stdout became U+FFFD and re-encoded to three: `b"a\xffb"`
        # is 3 bytes on stdout and recorded 5. `bytes` stopped being what the hook wrote and
        # became what a round-trip would write. Recording one unit and inferring the other is
        # named in this docstring as how P3 got three wrong anchors, and it was happening here.
        # (Review round 4.)
        "data": {"chars": len(raw.decode("utf-8", errors="replace")), "bytes": len(raw)},
    }


def _has_unmatched_offer(session_id: str) -> bool:
    """Is there an offer in this session's log that no measurement has answered yet?

    PER HOOK RUN, NOT PER SESSION. The first version asked "has this session ever recorded an
    offer", and SessionStart fires several times per session id (5 under one id, measured) —
    so on run #2, run #1's offer satisfied the check and a measurement could still be written
    with no obligation of its own, which is the orphan the guard exists to prevent. The
    contract's "a measurement is never written without its obligation" was therefore weaker
    than it read. Counting makes it per-run: each offer answers exactly one measurement.
    (Review round 3.)

    PER-LINE PARSE, NOT A SUBSTRING. The first version searched the raw text for
    `"restore_offered"`, on the reasoning that a malformed line must not be able to suppress
    a measurement — which a per-line `try/except` preserves anyway. This log is the SHARED
    `.tessera/logs/<session>.jsonl` channel; `suggestion_gate`, `degraded` and `verification`
    all write free-text notes to it, and in this repo those notes discuss event names.

    Review flagged that as exploitable and its specific mechanism does NOT hold — `json.dumps`
    escapes inner quotes, so a note mentioning the event encodes to `\"restore_offered\"`,
    which does not contain the searched substring. Measured before changing anything. What
    remains real is narrower and enough: nothing stops a future producer from writing a KEY
    by that name, and `scan.py` next door already reads `type` per line. Matching the field
    the event actually uses costs nothing and does not depend on JSON escaping semantics
    holding for every producer that ever shares this channel.
    """
    try:
        text = paths.log_path(session_id).read_text(errors="replace")
    except OSError:
        return False
    offers = delivered = 0
    for line in text.splitlines():
        try:
            kind = json.loads(line).get("type")
        except (ValueError, AttributeError):
            continue    # a malformed or non-object line is not an offer, and must not be
                        # able to suppress the measurement either
        if kind == "restore_offered":
            offers += 1
        elif kind == "restore_delivered":
            delivered += 1
    return offers > delivered


def _append(event: dict, session_id: str) -> int:
    """Append or stay silent. Recording an obligation must never become one."""
    path = paths.log_path(session_id)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a") as f:
            f.write(json.dumps(event) + "\n")
    except OSError:
        return 0
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    session_id = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    if not session_id:
        return 0  # no key to file under; silent — this must never break session start

    if argv and "--delivered-stdin" not in argv:
        # AN UNRECOGNISED ARGUMENT MUST NOT FALL THROUGH TO THE OFFER PATH. It did, so
        # `offer.py --delivered-chars` — the invocation this file's own docstring header
        # advertised until 2026-08-22, naming a flag that never existed — appended a spurious
        # `restore_offered`. That is a PHANTOM OBLIGATION: `scan.py` demands a receipt for it
        # at Stop and `_delivered_note` counts it as a shortfall. A stale doc line that is
        # also an executable footgun, in the file whose own history is that a doc-only mention
        # defeated the first feature-detect. (Review round 5.)
        return 0
    if "--delivered-stdin" in argv:
        # The measurement pass: the hook pipes in exactly the text it printed. It does NOT
        # re-check the checkpoint — the hook only calls this when it printed a restore, and
        # re-reading the file here would make the measurement depend on the payload still
        # being on disk at the end of the hook.
        #
        # IT DOES CHECK THAT AN OFFER EXISTS, and that check is what makes the contract's
        # "a measurement can never exist without the obligation it belongs to" TRUE rather
        # than merely usual. The hook guards on `$_OFF_PATH`, which means only "offer.py
        # exited 0" — and this file returns 0 on every path INCLUDING the ones where it
        # deliberately writes nothing (no session id, no checkpoint, unwritable log). So a
        # cwd/TESSERA_ROOT disagreement, or a checkpoint removed mid-hook, yields a
        # `restore_delivered` with no `restore_offered`; `scan.py` then reads that session
        # as "nothing was owed" while a measurement claims delivery. Observed live on
        # 2026-08-22 under a redirected TESSERA_ROOT, noticed, and not acted on until review
        # named it. Anchoring the check HERE rather than in the shell is deliberate: this is
        # the process that knows the log path, and the shell cannot learn it without
        # duplicating this file's session-keyed anchoring.
        if not _has_unmatched_offer(session_id):
            return 0
        try:
            # RAW BYTES, DECODED INSIDE build_delivered. `sys.stdin.read()` uses the ambient
            # locale encoding — the very hazard this design moved out of bash — and handing
            # the decoded string onward made the byte count an inference rather than a
            # measurement (rounds 3 and 4).
            raw = sys.stdin.buffer.read()
        except (OSError, ValueError, AttributeError):
            return 0  # a lost measurement is the designed fail-open; the offer still stands
        return _append(build_delivered(raw, session_id=session_id), session_id)

    ck = paths.root() / ".mnemos" / "checkpoint-latest.json"
    try:
        raw = ck.read_bytes()
        data = json.loads(raw)
    except (OSError, ValueError):
        return 0  # no checkpoint offered, so nothing is owed

    return _append(build_offer(data, len(raw), session_id=session_id), session_id)


if __name__ == "__main__":
    sys.exit(main())
