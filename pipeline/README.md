# Content pipeline

Templates over Wikidata → candidate prompts → automatic filters → human review → scheduled holes → D1. Spec: `docs/04-content-pipeline.md`. The query result *is* the answer list; nothing here asks an LLM for answers (hard rule 4).

## Setup

```bash
cd pipeline
python -m venv .venv
.venv/Scripts/python -m pip install -e .[dev]     # macOS/Linux: .venv/bin/python
```

## The loop

```bash
python -m bk generate            # all templates -> out/candidates.json, rebuilds content/pools/
python -m bk review              # approve / edit / add aliases / reject, one candidate at a time
python -m bk status              # counts per league; approved prompts whose answers changed upstream
python -m bk schedule --days 30  # fills days without a hole, from tomorrow
python -m bk export              # holes from tomorrow -> out/content.json
cd .. && pnpm db:load            # into local D1 (`--remote` for production)
```

`generate` caches every HTTP response in `.cache/`; pass `--refresh` to refetch (do this before scheduling past an awards season). `review --all` also shows candidates the filters rejected; approving one overrides the filter. `review --redo` revisits decisions.

## What lives where

| Path | What | In git |
|---|---|---|
| `templates/*.yaml` | Prompt templates: text, params / group_by, SPARQL, change windows | yes |
| `pools/*.yaml` | Pool definitions: the plausible names auto-correct matches against | yes |
| `franchises.yaml` | Current franchises per league and their former Wikidata items | yes |
| `content/reviews.json` | Review decisions; an approval freezes the text, answers and priors | yes |
| `content/aliases.json` | Aliases added or dropped during review | yes |
| `content/pools/*.json` | Built pools (entities, hints, aliases) | yes |
| `content/schedule.json` | Date → hole number → five prompt keys | yes |
| `out/` | `candidates.json`, `content.json` | no |

## Templates

See the docstring in `bk/templates.py` for every field. Two shapes:

- **params**: a grid; each combination is one prompt (`nhl-award-winners` × five trophies).
- **group_by**: each distinct value of the named variables is one prompt (`nba-played-for-both` makes one per franchise pair, keeping the `max_candidates` with the best-known answers).

A query returns `?item` (the answers) and optionally `?event` (each award year or final found). With `expect_events`, a candidate whose events fall short of the expected count is flagged `incomplete?`. Wikidata's sports data has gaps (the Cy Young and Hall of Fame lists are far from complete), so read every list before approving.

`changes` lists the windows when an answer list can change (`"06-01..06-25"` for the NBA Finals). The scheduler won't place a prompt on a date if a window falls between when its answers were fetched and the hole date.

## Priors and filters

`prior(a) = views(a)^0.8 / Σ views^0.8`, from 12 full months of English Wikipedia pageviews (no article = 1 view). Candidates are rejected with fewer than 5 or more than 60 answers, a top prior under 0.15, or no answer under 0.01. Overlap (> 30% shared answers within 14 days) and volatility are checked when scheduling.
