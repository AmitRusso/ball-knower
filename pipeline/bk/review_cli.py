"""Interactive review: approve, edit, add aliases or reject each candidate."""

import datetime as dt
from typing import Any

from . import pools, reviews
from .tiers import tier_for_share

HELP = """  a  approve            r  reject (asks for a reason)
  t  edit text          n  edit note           s  edit short label
  +  add alias: "+ 3 big o"   (answer number, then the alias)
  -  drop alias: "- 3 king"   k  skip           q  quit"""


def _pool_entities(pool_id: str) -> dict[str, dict[str, Any]]:
    built = pools.load_built(pool_id)
    return {e["qid"]: e for e in built["entities"]} if built else {}


def show(c: dict[str, Any], n: int, total: int, ents: dict[str, dict[str, Any]]) -> None:
    print("\n" + "─" * 78)
    print(f"[{n}/{total}] {c['key']}   {c['league']} · pool {c['pool']} ({len(ents)} entities)")
    print(f"  TEXT  {c['text']}")
    if c.get("note"):
        print(f"  NOTE  {c['note']}")
    if c.get("short"):
        print(f"  SHORT {c['short']}")
    for f in c.get("flags", []):
        print(f"  FLAG  {f}")
    for r in c.get("rejected", []):
        print(f"  FILTERED  {r}")
    if c.get("changes"):
        print(f"  CHANGES  {', '.join(c['changes'])} (answer list can change then)")
    print(f"  {len(c['answers'])} answers · expected {c.get('expected_yards', '?')} yds/shot")
    for i, a in enumerate(c["answers"], 1):
        prior = a.get("prior")
        tier = tier_for_share(prior).id if prior is not None else ""
        aliases = ", ".join(ents.get(a["qid"], {}).get("aliases", [])[:6])
        prior_s = f"{prior * 100:5.1f}%" if prior is not None else "   ?  "
        print(f"  {i:>3}. {a.get('name', a['qid'])[:30]:<30} {prior_s} {tier:<13} {a['qid']:<10} {aliases[:40]}")


def run(today: dt.date, include_filtered: bool = False, redo: bool = False, template: str | None = None) -> None:
    revs = reviews.load()
    queue = [
        c
        for c in reviews.candidates()
        if (include_filtered or not c["rejected"])
        and (redo or c["key"] not in revs)
        and (not template or c["template"] == template)
        and c["answers"] and "prior" in c["answers"][0]
    ]
    if not queue:
        print("Nothing to review. Run `python -m bk generate` first, or pass --all / --redo.")
        return
    print(HELP)
    approved = 0
    for n, c in enumerate(queue, 1):
        ents = _pool_entities(c["pool"])
        while True:
            show(c, n, len(queue), ents)
            cmd = input("  > ").strip()
            op, _, arg = cmd.partition(" ")
            if op == "a":
                reviews.approve(revs, c, today)
                reviews.save(revs)
                approved += 1
                break
            if op == "r":
                reviews.reject(revs, c["key"], today, arg or input("  reason: ").strip())
                reviews.save(revs)
                break
            if op in ("t", "n", "s"):
                field = {"t": "text", "n": "note", "s": "short"}[op]
                value = arg or input(f"  new {field}: ").strip()
                if value or field != "text":
                    c[field] = value
            elif op in ("+", "-"):
                num, _, alias = arg.partition(" ")
                if num.isdigit() and 1 <= int(num) <= len(c["answers"]) and alias:
                    qid = c["answers"][int(num) - 1]["qid"]
                    reviews.add_alias(c["pool"], qid, alias.strip(), drop=op == "-")
                    print(f"  alias saved; run `python -m bk pools` to rebuild {c['pool']}")
                else:
                    print('  usage: "+ 3 big o"')
            elif op == "k":
                break
            elif op == "q":
                print(f"Approved {approved} this session.")
                return
            else:
                print(HELP)
    print(f"Queue done. Approved {approved} this session.")
