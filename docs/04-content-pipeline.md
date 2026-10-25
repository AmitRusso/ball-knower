# 04 — Content pipeline

How prompts get made without hand-writing 5 a day forever.

**Principle: generate prompts from real sports data. The query result *is* the answer list.** An LLM may help phrase prompts or brainstorm templates; it never produces answer lists (hard rule in `CLAUDE.md`).

## Flow

```
templates ──► query open data ──► candidate prompts ──► filters ──► review queue ──► scheduled holes ──► cron publishes
   (YAML)       (Wikidata, stats         (text + answers        (count, spread,    (you approve a     (holes table)      (00:00 UTC)
                 datasets)               + priors)               overlap, league)   week at a time)
```

Lives in `pipeline/` (Python 3.12+), run locally or from a scheduled GitHub Action. Output is SQL / JSON loaded into D1 with `wrangler d1 execute`.

## Templates

A template is a parameterized question plus the query that answers it.

```yaml
# pipeline/templates/nba_franchise_titles.yaml
id: nba-franchise-titles
league: NBA
pool: nba-franchises
text: "Name an NBA franchise with more than {n} championships."
note: "Relocated franchises count."
params:
  n: [2, 3, 4, 5]
source: wikidata
query: |
  # SPARQL: NBA franchises and their championship counts
  ...
answer_filter: "titles > n"
```

One template × its parameter grid → many candidate prompts. Examples of template families:

| Family | Example |
|---|---|
| Award winners | Non-QB NFL MVP · Cy Young winner who was a reliever · NBA Finals MVP not born in the US |
| Career milestones | 300-win pitcher · 500-HR hitter · 30,000-point NBA scorer |
| Single-season feats | Averaged a triple-double for a season · 2,000-yard rusher |
| Team history | Franchise with 5+ titles · team that has never reached the final |
| Geography | Summer Olympics host country · country that has won the World Cup · NFL team that played in London |
| Connections | Played for both the Lakers and the Celtics · Hall of Famer drafted in round 3+ |

## Data sources

| Source | Good for | License note |
|---|---|---|
| **Wikidata** (SPARQL) | Awards, championships, hosts, franchises, nationalities, Hall of Fame | CC0 — free to use |
| Lahman Baseball Database | MLB career and season stats | Check current license terms |
| nflverse | NFL rosters, stats, draft | Check current license terms |
| Wikipedia list pages | Cross-checking answer lists by hand | CC BY-SA text — use for verification, don't copy prose |
| **Wikipedia pageviews API** | Popularity → rarity priors | Free |

Sports Reference sites restrict scraping and reuse — use them only for manual spot checks, not as a pipeline source.

## Rarity priors

For each answer, fetch ~12 months of Wikipedia pageviews. Within a prompt:

```
prior(a) = views(a)^α / Σ views^α      // α ≈ 0.8 flattens the head a bit
```

Famous names get large priors (likely Bench Warmer at first), deep cuts small ones. Live picks take over through the blend in `03-architecture.md`.

## Filters (automatic rejection)

- **Answer count** outside 5–60
- **No spread:** top answer's prior < 0.15 or no answer with prior < 0.01 (needs both obvious and obscure options)
- **Fuzzy definition:** template flagged `needs_review_definition` (e.g. "championship" in leagues with pre-merger history)
- **Overlap:** shares > 30% of answers with another prompt scheduled within 14 days
- **Recency risk:** answer list could change within the scheduling window (a season in progress, an award not yet given) → mark `volatile`, schedule only after the event

## Daily hole assembly

From the approved pool, pick 5 prompts per day:

- at least 3 different leagues, at most 2 from one
- one "any sport" or geography wildcard most days
- difficulty mix: average expected yards (from priors) within a target band
- no prompt reused within 365 days (Driving Range excepted)

## Review

A small CLI (`pipeline/review.py`) shows each candidate with its full answer list, priors and the pool it draws auto-correct from. Approve, edit text, add aliases, or reject. Approving a week (35 prompts) should take ~15 minutes.

Things a human catches that filters don't:
- awkward phrasing
- definition fights ("does the Minneapolis Lakers title count?" → write it in the note)
- missing aliases (nicknames, old team names, accent-free spellings)
- answers that are technically right but feel unfair

## Entity pools

Each prompt points at a pool used for auto-correct (`nba-franchises`, `mlb-players`, `countries`, …). Pools are versioned; adding entities bumps the version so clients refetch. A pool must contain **plausible wrong answers** too — that's what keeps auto-correct from leaking correctness.
