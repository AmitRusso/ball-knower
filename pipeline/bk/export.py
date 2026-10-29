"""Scheduled holes -> out/content.json, loaded into D1 by `pnpm db:load` (scripts/load-content.ts)."""

import datetime as dt
import json
from typing import Any

from . import pools, schedule
from .paths import EXPORT
from .reviews import approved_snapshots
from .store import write_json
from .templates import load_all


def build(since: dt.date) -> dict[str, Any]:
    sched = schedule.load()
    by_key = {p["key"]: p for p in approved_snapshots()}
    templates = {t.id: t for t in load_all()}
    holes, pool_ids, template_ids = [], set(), set()
    built_pools: dict[str, dict[str, Any]] = {}

    for h in sched["holes"]:
        if dt.date.fromisoformat(h["date"]) < since:
            continue
        prompts = []
        for position, key in enumerate(h["prompts"]):
            p = by_key.get(key)
            if not p:
                raise ValueError(f"{h['date']}: {key} is scheduled but not approved")
            pool = built_pools.get(p["pool"]) or pools.load_built(p["pool"])
            if not pool:
                raise ValueError(f"Pool {p['pool']} isn't built; run `python -m bk pools`")
            built_pools[p["pool"]] = pool
            in_pool = {e["qid"] for e in pool["entities"]}
            missing = [a["name"] for a in p["answers"] if a["qid"] not in in_pool]
            if missing:
                raise ValueError(f"{key}: answers missing from pool {p['pool']}: {missing}")
            pool_ids.add(p["pool"])
            template_ids.add(p["template"])
            prompts.append(
                {
                    "position": position,
                    "text": p["text"],
                    "note": p.get("note") or None,
                    "league": p["league"],
                    "poolId": p["pool"],
                    "templateId": p["template"],
                    "answers": [
                        {"entityId": pools.entity_id(pool["prefix"], a["qid"]), "priorShare": a["prior"]}
                        for a in p["answers"]
                    ],
                }
            )
        holes.append({"holeNo": h["hole_no"], "date": h["date"], "prompts": prompts})

    return {
        "pools": [
            {
                "id": pid,
                "name": built_pools[pid]["name"],
                "entities": [
                    {
                        "id": e["id"],
                        "name": e["name"],
                        "hint": e["hint"],
                        "aliases": e["aliases"],
                        "popularity": e["popularity"],
                        "wikidataId": e["qid"],
                    }
                    for e in built_pools[pid]["entities"]
                ],
            }
            for pid in sorted(pool_ids)
        ],
        "templates": [
            {
                "id": tid,
                "league": templates[tid].league,
                "poolId": templates[tid].pool,
                "text": templates[tid].text,
                "definition": json.dumps(
                    {"query": templates[tid].query, "params": templates[tid].params, "group_by": templates[tid].group_by},
                    ensure_ascii=False,
                ),
            }
            for tid in sorted(template_ids)
        ],
        "holes": holes,
    }


def run(since: dt.date, log=print) -> None:
    content = build(since)
    write_json(EXPORT, content)
    log(f"{len(content['holes'])} holes, {len(content['pools'])} pools -> {EXPORT}")
    log("Load with `pnpm db:load` (local) or `pnpm db:load --remote`.")
