"""python -m bk <command> — see pipeline/README.md."""

import argparse
import datetime as dt
import sys

from . import export, generate, http, review_cli, reviews, schedule


def _date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    today = dt.datetime.now(dt.UTC).date()
    tomorrow = today + dt.timedelta(days=1)

    ap = argparse.ArgumentParser(prog="python -m bk")
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="run templates -> out/candidates.json, rebuild pools")
    g.add_argument("templates", nargs="*", help="template ids (default: all)")
    g.add_argument("--refresh", action="store_true", help="ignore the HTTP cache")

    sub.add_parser("pools", help="rebuild pools from candidates + approved prompts")

    r = sub.add_parser("review", help="approve / edit / reject candidates")
    r.add_argument("--all", action="store_true", help="include candidates the filters rejected")
    r.add_argument("--redo", action="store_true", help="include already-reviewed candidates")
    r.add_argument("--template")

    sub.add_parser("status", help="counts, and approved prompts whose answers changed upstream")

    s = sub.add_parser("schedule", help="assemble holes for days without one")
    s.add_argument("--start", type=_date, default=tomorrow)
    s.add_argument("--days", type=int, default=30)

    u = sub.add_parser("unschedule", help="remove a future hole from the schedule")
    u.add_argument("date", type=_date)

    e = sub.add_parser("export", help="scheduled holes -> out/content.json for `pnpm db:load`")
    e.add_argument("--since", type=_date, default=tomorrow, help="first hole date (default tomorrow)")

    args = ap.parse_args(argv)

    if args.cmd == "generate":
        http.refresh = args.refresh
        generate.run(today, args.templates or None)
    elif args.cmd == "pools":
        cands = reviews.candidates()
        pool_ids = {c["pool"] for c in [*cands, *reviews.approved_snapshots()]}
        generate.build_pools(pool_ids, cands)
    elif args.cmd == "review":
        review_cli.run(today, include_filtered=args.all, redo=args.redo, template=args.template)
    elif args.cmd == "status":
        status()
    elif args.cmd == "schedule":
        schedule.run(args.start, args.days)
    elif args.cmd == "unschedule":
        print("removed" if schedule.unschedule(args.date, today) else "no hole on that date")
    elif args.cmd == "export":
        export.run(args.since)
    return 0


def status() -> None:
    from collections import Counter

    cands = reviews.candidates()
    revs = reviews.load()
    passing = [c for c in cands if not c["rejected"]]
    pending = [c for c in passing if c["key"] not in revs]
    approved = reviews.approved_snapshots()
    sched = schedule.load()
    used = {k for h in sched["holes"] for k in h["prompts"]}
    print(f"candidates {len(cands)} · pass filters {len(passing)} · pending review {len(pending)}")
    print(f"approved {len(approved)} · unscheduled approved {sum(p['key'] not in used for p in approved)}")
    print("approved by league: " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(p['league'] for p in approved).items())))
    if sched["holes"]:
        print(f"scheduled {len(sched['holes'])} holes: {sched['holes'][0]['date']} … {sched['holes'][-1]['date']}")
    for key, added, removed in reviews.drift(revs, cands):
        print(f"DRIFT {key}: +{len(added)} −{len(removed)} answers since approval (review --redo --template ...)")


if __name__ == "__main__":
    raise SystemExit(main())
