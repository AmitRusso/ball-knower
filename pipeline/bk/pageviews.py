"""Wikipedia pageviews (Wikimedia REST API) -> popularity for rarity priors."""

import datetime as dt
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

from . import http

API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user"
WORKERS = 4


def window(today: dt.date, months: int = 12) -> tuple[str, str]:
    """The last `months` full calendar months before `today`, as API timestamps."""
    end = today.replace(day=1) - dt.timedelta(days=1)
    y, m = end.year, end.month - months + 1
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y:04d}{m:02d}01", end.strftime("%Y%m%d")


def views(title: str, start: str, end: str) -> int:
    """Total user (non-bot) views of one English Wikipedia article; 0 if unknown."""
    path = urllib.parse.quote(title.replace(" ", "_"), safe="")
    res = http.fetch_json(f"{API}/{path}/monthly/{start}/{end}")
    if not res:
        return 0
    return sum(int(i.get("views", 0)) for i in res.get("items", []))


def views_many(titles: dict[str, str | None], today: dt.date) -> dict[str, int]:
    """QID -> 12-month views, for QIDs with an English article (others get 0)."""
    start, end = window(today)
    known = {q: t for q, t in titles.items() if t}
    with ThreadPoolExecutor(WORKERS) as pool:
        counts = dict(zip(known, pool.map(lambda t: views(t, start, end), known.values())))
    return {q: counts.get(q, 0) for q in titles}
