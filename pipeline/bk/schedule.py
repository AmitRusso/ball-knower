"""Daily hole assembly (docs/04-content-pipeline.md, "Daily hole assembly").

Picks 5 approved prompts per day: at least 3 leagues and at most 2 from one,
a wildcard (any sport / Olympics) when one fits, different templates when
possible, average expected yards near
the pool's median, no answer-list overlap above 30% with prompts within 14
days, nothing reused within 365 days, nothing whose answers may change before
the hole is played.
"""

import datetime as dt
import random
import statistics
from collections import Counter
from typing import Any

from .filters import MAX_OVERLAP, OVERLAP_DAYS, overlap, volatile_between
from .paths import SCHEDULE
from .reviews import approved_snapshots
from .store import read_json, write_json

PROMPTS_PER_HOLE = 5
MIN_LEAGUES = 3
MAX_PER_LEAGUE = 2
REUSE_DAYS = 365
TRIES = 3000
# Yards of difficulty mismatch worth one repeated template (two "played for both" in a hole).
REPEAT_PENALTY = 3

# Hole numbers follow the date: the sample hole was hole 214 on 2026-10-28.
DEFAULT_BASE = {"date": "2026-10-28", "hole_no": 214}


def load() -> dict[str, Any]:
    return read_json(SCHEDULE, None) or {"base": DEFAULT_BASE, "holes": []}


def save(sched: dict[str, Any]) -> None:
    sched["holes"].sort(key=lambda h: h["date"])
    write_json(SCHEDULE, sched)


def hole_no(sched: dict[str, Any], day: dt.date) -> int:
    base = sched["base"]
    return base["hole_no"] + (day - dt.date.fromisoformat(base["date"])).days


def _answers(p: dict[str, Any]) -> set[str]:
    return {a["qid"] for a in p["answers"]}


def valid_hole(prompts: list[dict[str, Any]]) -> bool:
    leagues = Counter(p["league"] for p in prompts)
    if len(leagues) < MIN_LEAGUES or max(leagues.values()) > MAX_PER_LEAGUE:
        return False
    return all(
        overlap(_answers(a), _answers(b)) <= MAX_OVERLAP
        for i, a in enumerate(prompts)
        for b in prompts[i + 1 :]
    )


def eligible(
    day: dt.date, approved: list[dict[str, Any]], sched: dict[str, Any]
) -> list[dict[str, Any]]:
    by_key = {p["key"]: p for p in approved}
    used_recently: set[str] = set()
    nearby: list[set[str]] = []
    for h in sched["holes"]:
        gap = abs((dt.date.fromisoformat(h["date"]) - day).days)
        if gap < REUSE_DAYS:
            used_recently.update(h["prompts"])
        if gap <= OVERLAP_DAYS:
            nearby.extend(_answers(by_key[k]) for k in h["prompts"] if k in by_key)
    out = []
    for p in approved:
        if p["key"] in used_recently:
            continue
        if volatile_between(p.get("changes") or [], dt.date.fromisoformat(p["generated"]), day):
            continue
        if any(overlap(_answers(p), other) > MAX_OVERLAP for other in nearby):
            continue
        out.append(p)
    return out


def pick(day: dt.date, pool: list[dict[str, Any]], target: float) -> list[dict[str, Any]] | None:
    """Best of TRIES random valid holes: closest average expected yards, wildcard preferred."""
    rng = random.Random(day.isoformat())
    best: tuple[float, list[dict[str, Any]]] | None = None
    wildcards = [p for p in pool if p.get("wildcard")]
    for _ in range(TRIES):
        hole: list[dict[str, Any]] = []
        if wildcards and rng.random() < 0.9:
            hole.append(rng.choice(wildcards))
        order = pool[:]
        rng.shuffle(order)
        for p in order:
            if len(hole) == PROMPTS_PER_HOLE:
                break
            if p in hole:
                continue
            if valid_partial(hole + [p]):
                hole.append(p)
        if len(hole) < PROMPTS_PER_HOLE or not valid_hole(hole):
            continue
        avg = statistics.fmean(p.get("expected_yards") or target for p in hole)
        repeats = len(hole) - len({p["template"] for p in hole})
        score = abs(avg - target) + (0 if any(p.get("wildcard") for p in hole) else 5) + REPEAT_PENALTY * repeats
        if best is None or score < best[0]:
            best = (score, hole)
    if not best:
        return None
    hole = best[1][:]
    rng.shuffle(hole)
    return hole


def valid_partial(prompts: list[dict[str, Any]]) -> bool:
    """Can still become a valid hole: league cap, enough leagues left, no overlap."""
    leagues = Counter(p["league"] for p in prompts)
    if max(leagues.values()) > MAX_PER_LEAGUE:
        return False
    remaining = PROMPTS_PER_HOLE - len(prompts)
    if len(leagues) + remaining < MIN_LEAGUES:
        return False
    last = prompts[-1]
    return all(
        overlap(_answers(p), _answers(last)) <= MAX_OVERLAP for p in prompts[:-1]
    )


def run(start: dt.date, days: int, log=print) -> dict[str, Any]:
    sched = load()
    approved = approved_snapshots()
    if not approved:
        log("No approved prompts. Run `python -m bk review` first.")
        return sched
    target = statistics.median(p.get("expected_yards") or 0 for p in approved)
    taken = {h["date"] for h in sched["holes"]}
    added = 0
    for i in range(days):
        day = start + dt.timedelta(days=i)
        if day.isoformat() in taken:
            continue
        pool = eligible(day, approved, sched)
        hole = pick(day, pool, target)
        if not hole:
            log(f"{day}: stopped — {len(pool)} eligible prompts can't make a valid hole. Approve more.")
            break
        sched["holes"].append(
            {"date": day.isoformat(), "hole_no": hole_no(sched, day), "prompts": [p["key"] for p in hole]}
        )
        added += 1
        leagues = " ".join(p["league"] for p in hole)
        avg = statistics.fmean(p.get("expected_yards") or 0 for p in hole)
        log(f"{day}  hole {hole_no(sched, day)}  {leagues}  ~{avg:.0f} yds/shot")
    save(sched)
    log(f"Scheduled {added} new holes (target {target:.0f} yds/shot). {len(approved)} approved prompts.")
    return sched


def unschedule(day: dt.date, today: dt.date) -> bool:
    if day <= today:
        raise ValueError("Only future holes can be unscheduled")
    sched = load()
    before = len(sched["holes"])
    sched["holes"] = [h for h in sched["holes"] if h["date"] != day.isoformat()]
    save(sched)
    return len(sched["holes"]) < before
