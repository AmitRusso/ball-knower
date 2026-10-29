"""Polite, cached HTTP for Wikidata and Wikimedia APIs (stdlib only)."""

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .paths import CACHE

# Wikimedia asks every client to identify itself with a contact.
USER_AGENT = "BallKnowerPipeline/0.1 (https://github.com/AmitRusso/ball-knower)"

# Set by the CLI's --refresh flag: ignore cached responses (still writes new ones).
refresh = False


def _cache_path(key: str):
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return CACHE / digest[:2] / f"{digest}.json"


def fetch_json(
    url: str,
    *,
    params: dict[str, str] | None = None,
    data: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
    cache: bool = True,
    retries: int = 8,
) -> Any:
    """GET (or form POST when `data` is given) and parse JSON, cached on disk under pipeline/.cache/."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    body = urllib.parse.urlencode(data).encode("utf-8") if data else None
    key = url + "\n" + (body.decode("utf-8") if body else "")
    path = _cache_path(key)
    if cache and not refresh and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    req_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    req_headers.update(headers or {})
    delay = 2.0
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                payload = json.loads(res.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as err:
            if err.code == 404:
                payload = None
                break
            if err.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise
            wait = float(err.headers.get("Retry-After") or delay)
            print(f"  HTTP {err.code}, retrying in {wait:.0f}s", flush=True)
        except (OSError, ValueError):  # URLError, timeouts, dropped connections, truncated JSON
            if attempt == retries - 1:
                raise
            wait = delay
            print(f"  retrying {url[:80]}… in {wait:.0f}s", flush=True)
        time.sleep(wait)
        delay *= 2

    if cache:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload
