"""Automatic checks from docs/04-content-pipeline.md, "Filters".

`reject_reasons` runs at generation time; overlap and volatility depend on the
date a prompt is scheduled for, so they live here but are applied by the scheduler.
"""

import datetime as dt

MIN_ANSWERS = 5
MAX_ANSWERS = 60
MIN_TOP_PRIOR = 0.15
MAX_RARE_PRIOR = 0.01
MAX_OVERLAP = 0.30
OVERLAP_DAYS = 14


def count_reason(n: int) -> str | None:
    if not MIN_ANSWERS <= n <= MAX_ANSWERS:
        return f"{n} answers (needs {MIN_ANSWERS}–{MAX_ANSWERS})"
    return None


def reject_reasons(priors: list[float]) -> list[str]:
    reasons = []
    if r := count_reason(len(priors)):
        reasons.append(r)
    if priors and max(priors) < MIN_TOP_PRIOR:
        reasons.append(f"no obvious answer (top prior {max(priors):.3f} < {MIN_TOP_PRIOR})")
    if priors and min(priors) >= MAX_RARE_PRIOR:
        reasons.append(f"no deep cut (rarest prior {min(priors):.3f} ≥ {MAX_RARE_PRIOR})")
    return reasons


def overlap(a: set[str], b: set[str]) -> float:
    """Share of the smaller list that also appears in the other."""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def _md(s: str) -> tuple[int, int]:
    m, d = s.split("-")
    return int(m), int(d)


def _window_dates(window: str, year: int) -> tuple[dt.date, dt.date]:
    start, end = (dt.date(year, *_md(s)) for s in window.split(".."))
    if end < start:  # wraps the new year, e.g. "12-15..01-10"
        end = dt.date(year + 1, *_md(window.split("..")[1]))
    return start, end


def volatile_between(changes: list[str], generated: dt.date, day: dt.date) -> str | None:
    """The change window (if any) between when the answers were fetched and the hole date."""
    for window in changes:
        for year in range(generated.year - 1, day.year + 1):
            start, end = _window_dates(window, year)
            if start <= day and end >= generated:
                return window
    return None
