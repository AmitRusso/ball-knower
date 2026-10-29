"""Review decisions (content/reviews.json).

Approving a candidate freezes a snapshot of it — text, note and the answer list
with priors — so a later `generate` can't silently change an approved prompt.
"""

import datetime as dt
from typing import Any

from .paths import ALIASES, CANDIDATES, REVIEWS
from .store import read_json, write_json

SNAPSHOT_FIELDS = (
    "key", "template", "league", "pool", "wildcard", "text", "short", "note",
    "changes", "flags", "generated", "expected_yards",
)  # fmt: skip


def load() -> dict[str, dict[str, Any]]:
    return read_json(REVIEWS, {}) or {}


def save(reviews: dict[str, dict[str, Any]]) -> None:
    write_json(REVIEWS, reviews)


def candidates() -> list[dict[str, Any]]:
    return read_json(CANDIDATES, []) or []


def snapshot(cand: dict[str, Any]) -> dict[str, Any]:
    snap = {k: cand.get(k) for k in SNAPSHOT_FIELDS}
    snap["answers"] = [{"qid": a["qid"], "name": a["name"], "prior": a["prior"]} for a in cand["answers"]]
    return snap


def approve(reviews: dict, cand: dict[str, Any], today: dt.date) -> None:
    reviews[cand["key"]] = {"status": "approved", "reviewed": today.isoformat(), "prompt": snapshot(cand)}


def reject(reviews: dict, key: str, today: dt.date, reason: str = "") -> None:
    reviews[key] = {"status": "rejected", "reviewed": today.isoformat(), "reason": reason}


def approved_snapshots() -> list[dict[str, Any]]:
    return [r["prompt"] for r in load().values() if r["status"] == "approved"]


def drift(reviews: dict, cands: list[dict[str, Any]]) -> list[tuple[str, set[str], set[str]]]:
    """Approved prompts whose freshly generated answer list differs: (key, added, removed)."""
    by_key = {c["key"]: c for c in cands}
    out = []
    for key, r in sorted(reviews.items()):
        c = by_key.get(key)
        if r["status"] != "approved" or not c:
            continue
        old = {a["qid"] for a in r["prompt"]["answers"]}
        new = {a["qid"] for a in c["answers"]}
        if old != new:
            out.append((key, new - old, old - new))
    return out


def add_alias(pool: str, qid: str, alias: str, drop: bool = False) -> None:
    data = read_json(ALIASES, {}) or {}
    entry = data.setdefault(pool, {}).setdefault(qid, {})
    bucket = entry.setdefault("drop" if drop else "add", [])
    if alias not in bucket:
        bucket.append(alias)
        bucket.sort()
    write_json(ALIASES, data)
