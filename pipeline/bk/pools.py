"""Entity pools: everything auto-correct matches against (hard rule 2).

A pool (pipeline/pools/*.yaml) has id, name, prefix (entity ids are
`{prefix}-{QID}`), hint, and a SPARQL query returning ?item — the plausible
names, right and wrong. Every answer of every candidate and approved prompt on
the pool is added too, so an answer is never missing from its pool.
"""

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from . import wikidata
from .templates import load_franchises, render, shared_context
from .paths import ALIASES, BUILT_POOLS, POOLS
from .store import read_json, write_json

MAX_ALIAS_LENGTH = 40


@dataclass
class PoolDef:
    id: str
    name: str
    prefix: str
    query: str
    hint: str = ""
    names: dict[str, str] | None = None  # QID -> display name when the label is too formal
    former_names_from: str | None = None  # league in franchises.yaml: former team names -> aliases


def load_def(pool_id: str) -> PoolDef:
    path = POOLS / f"{pool_id}.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if raw.get("id") != pool_id:
        raise ValueError(f"{path.name}: id must match the file name")
    return PoolDef(**raw)


def entity_id(prefix: str, qid: str) -> str:
    return f"{prefix}-{qid}"


def built_path(pool_id: str) -> Path:
    return BUILT_POOLS / f"{pool_id}.json"


def load_built(pool_id: str) -> dict[str, Any] | None:
    return read_json(built_path(pool_id))


def clean_aliases(label: str, aliases: list[str], extra: list[str], drop: list[str]) -> list[str]:
    """Wikidata's English aliases plus manual ones, minus noise. Final dedupe
    (and dropping aliases that collide across entities) happens on normalized
    text in scripts/load-content.ts, which uses the app's own normalize()."""
    out = []
    dropped = {d.casefold() for d in drop}
    for a in [*aliases, *extra]:
        a = a.strip()
        if (
            not a
            or len(a) > MAX_ALIAS_LENGTH
            or "(" in a
            or a.casefold() == label.casefold()
            or a.casefold() in dropped
            or a.isdigit()
        ):
            continue
        if a not in out:
            out.append(a)
    return sorted(out)


def build(pool: PoolDef, answer_qids: set[str], describe=wikidata.describe, run_query=wikidata.sparql):
    """Build the pool and write content/pools/<id>.json. Versions are assigned by
    scripts/load-content.ts, which bumps one only when D1's copy differs."""
    qids = {r["item"] for r in run_query(render(pool.query, shared_context()))} | answer_qids
    items = describe(sorted(qids))
    overrides = (read_json(ALIASES, {}) or {}).get(pool.id, {})

    if pool.former_names_from:
        former = load_franchises()[pool.former_names_from].get("former") or {}
        old = describe(sorted(former))
        for old_qid, current in former.items():
            if current in items and old_qid in old:
                items[current].aliases.append(old[old_qid].label)
    for q, name in (pool.names or {}).items():
        if q in items:
            items[q].aliases.append(items[q].label)
            items[q].label = name
    labels = Counter(i.label.casefold() for i in items.values())
    entities = []
    for q, item in items.items():
        hint = pool.hint
        if labels[item.label.casefold()] > 1:
            # Two "Mike Smith"s: tell them apart by birth year (or QID).
            tag = f"b. {item.born}" if item.born else q
            hint = f"{hint}, {tag}" if hint else tag
        o = overrides.get(q, {})
        entities.append(
            {
                "id": entity_id(pool.prefix, q),
                "qid": q,
                "name": item.label,
                "hint": hint or None,
                "aliases": clean_aliases(item.label, item.aliases, o.get("add", []), o.get("drop", [])),
                "popularity": item.sitelinks,
            }
        )
    entities.sort(key=lambda e: (e["name"].casefold(), e["id"]))

    built = {"id": pool.id, "name": pool.name, "prefix": pool.prefix, "entities": entities}
    write_json(built_path(pool.id), built)
    return built
