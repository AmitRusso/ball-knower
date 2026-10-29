"""templates -> candidate prompts (answers + priors + filter results) -> pools."""

import datetime as dt
from typing import Any

from . import pageviews, pools, wikidata
from .filters import count_reason, reject_reasons
from .priors import priors
from .reviews import approved_snapshots
from .paths import CANDIDATES
from .store import read_json, write_json
from .templates import Template, expand, load_all, render
from .tiers import expected_yards

INTEREST_TOP = 5


def _interest(answers: list[str], items: dict[str, wikidata.Item]) -> int:
    """How well known the best answers are (sum of the top sitelink counts)."""
    links = sorted((items[q].sitelinks for q in answers if q in items), reverse=True)
    return sum(links[:INTEREST_TOP])


COVERAGE = 0.95


def _flags(t: Template, c: dict[str, Any]) -> list[str]:
    flags = ["needs_review_definition"] if t.needs_review_definition else []
    if t.warning:
        flags.append(t.warning)
    if t.expect_events:
        expected = int(render(t.expect_events, c["ctx"]))
        if c["events"] < COVERAGE * expected:
            flags.append(f"incomplete? Wikidata has {c['events']} of {expected} expected events")
    return flags


def candidates_for(t: Template, today: dt.date, log=print) -> list[dict[str, Any]]:
    expanded = expand(t, wikidata.sparql, lambda qids: {q: i.label for q, i in wikidata.describe(qids).items()})
    log(f"{t.id}: {len(expanded)} combinations")

    # Count first (cheap), then keep the most interesting before fetching pageviews.
    sized = [c for c in expanded if not count_reason(len(c["answers"]))]
    items = wikidata.describe(sorted({q for c in sized for q in c["answers"]}))
    sized.sort(key=lambda c: -_interest(c["answers"], items))
    if t.max_candidates:
        sized = sized[: t.max_candidates]
    keep = {c["key"] for c in sized}
    pool_names = pools.load_def(t.pool).names

    out = []
    for c in expanded:
        ctx = c["ctx"]
        base = {
            "key": c["key"],
            "template": t.id,
            "league": t.league,
            "pool": t.pool,
            "wildcard": t.is_wildcard,
            "text": render(t.text, ctx),
            "short": render(t.short, ctx) if t.short else "",
            "note": render(t.note, ctx) if t.note else "",
            "changes": t.changes,
            "flags": _flags(t, c),
            "generated": today.isoformat(),
        }
        if c["key"] not in keep:
            reason = count_reason(len(c["answers"])) or "below max_candidates cut"
            out.append({**base, "answers": [{"qid": q} for q in c["answers"]], "rejected": [reason]})
            continue
        titles = {q: items[q].enwiki if q in items else None for q in c["answers"]}
        names = {q: items[q].label for q in c["answers"] if q in items} | (pool_names or {})
        views = pageviews.views_many(titles, today)
        pr = priors(views)
        answers = sorted(
            (
                {"qid": q, "name": names.get(q, q), "views": views[q], "prior": pr[q]}
                for q in c["answers"]
            ),
            key=lambda a: (-a["prior"], a["name"]),
        )
        shares = [a["prior"] for a in answers]
        out.append(
            {
                **base,
                "answers": answers,
                "expected_yards": round(expected_yards(shares), 1),
                "rejected": reject_reasons(shares),
            }
        )
    return out


def run(today: dt.date, only: list[str] | None = None, log=print) -> list[dict[str, Any]]:
    templates = load_all(only)
    current = {t.id for t in load_all()}
    # Regenerating some templates keeps the others' candidates (minus deleted templates).
    cands = [c for c in read_json(CANDIDATES, []) if only and c["template"] in current and c["template"] not in only]
    for t in templates:
        cands.extend(candidates_for(t, today, log))
    write_json(CANDIDATES, cands)
    ok = sum(1 for c in cands if not c["rejected"])
    log(f"{len(cands)} candidates, {ok} pass the filters -> {CANDIDATES}")
    build_pools({c["pool"] for c in cands}, cands, log)
    return cands


def build_pools(pool_ids: set[str], cands: list[dict[str, Any]], log=print) -> None:
    approved = approved_snapshots()
    for pool_id in sorted(pool_ids):
        answers = {a["qid"] for c in [*cands, *approved] if c["pool"] == pool_id for a in c["answers"]}
        built = pools.build(pools.load_def(pool_id), answers)
        log(f"pool {pool_id}: {len(built['entities'])} entities")
