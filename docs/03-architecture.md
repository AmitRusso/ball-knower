# 03 — Architecture

Goal: web-served, but feels like a native app — tiny first load, instant typing feedback, answers never leak.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **SvelteKit + TypeScript** | Compiles to small bundles, no virtual DOM. Home and How to Play prerender as static HTML (good for search). |
| Adapter | `@sveltejs/adapter-cloudflare` | Pages + Workers from one project |
| Styling | Plain CSS + custom properties (`design/tokens.css`) | Small palette, three fonts — a utility framework adds nothing |
| Animation | Inline SVG + CSS / Web Animations API | One path and one circle; no library |
| Fonts | Self-hosted subsetted woff2 | No third-party round trip, no layout flash |
| Hosting / API | **Cloudflare Pages + Workers** | Static and API on the same edge network; near-zero cold start |
| Database | **Cloudflare D1** (SQLite) | Prompts, entities, answers, pick counts, plays |
| Cache | **Workers KV** | Today's hole payload and entity pools (immutable, long TTL) |
| Scheduler | **Cron Trigger** `0 0 * * *` | Publishes the next hole at 00:00 UTC, warms KV |
| PWA | Web manifest + service worker | Installable; instant shell on repeat visits |
| Share | Web Share API, clipboard fallback; OG images rendered at the edge (e.g. `workers-og`/Satori) | Shared links show the card |
| Analytics | Cloudflare Web Analytics | Cookie-free, no consent banner |
| Tests | Vitest, Playwright | Unit logic; full five-shot flow |
| CI/CD | GitHub Actions → `wrangler pages deploy` | Preview deploy per PR |
| Content pipeline | Python 3.12+, Wikidata SPARQL, open stats datasets | See `04-content-pipeline.md` |

**Escape hatch:** if a React mental model is preferred, Vite + Preact swaps in for SvelteKit with everything else unchanged.

## Request flow

```
            ┌──────────── Browser ────────────┐
 page load  │ static shell (prerendered, SW)  │
   ───────► │ GET /api/hole/today             │──► Worker ──► KV (hole payload)
            │ GET /api/pool/:poolId (lazy)    │──► Worker ──► KV (entity pool, immutable)
            │                                 │
  typing    │ auto-correct runs locally       │   (no network)
            │                                 │
  swing     │ POST /api/swing                 │──► Worker ──► D1 (validate, count, score)
            │                                 │
  finish    │ GET /api/hole/:n/answers        │──► Worker ──► D1 (only if play complete)
            └─────────────────────────────────┘
 00:00 UTC   Cron ──► Worker: publish next hole, write KV
```

## API

All responses JSON. `playerId` is a client-generated UUID (localStorage), sent as `X-Player-Id`.

### `GET /api/hole/today`

```json
{
  "holeNo": 214,
  "date": "2026-10-25",
  "lengthYds": 500,
  "secondsPerPrompt": 45,
  "prompts": [
    { "index": 0, "text": "Name an NFL MVP who wasn't a quarterback.", "note": "AP MVP award only.", "league": "NFL", "poolId": "nfl-players" }
  ]
}
```

No answers. Cached in KV; `Cache-Control: public, max-age=60`.

### `GET /api/pool/:poolId`

```json
{ "poolId": "nba-franchises", "version": 3, "entities": [ { "id": "nba-sas", "name": "San Antonio Spurs", "hint": "NBA", "aliases": ["spurs", "san antonio"] } ] }
```

Every entity in the pool — correct or not. Immutable per version (`max-age=31536000, immutable`). Large pools (all NFL players, ~25k+) are gzipped and lazy-loaded when the prompt that needs them is next; if a pool is too large for comfort, fall back to `GET /api/pool/:poolId/match?q=` with a 120 ms debounce.

### `POST /api/prompt/:index/start`

Records when the player was served a prompt (enforces the 45 s clock server-side, with ~5 s grace for latency).

### `POST /api/swing`

```json
// request
{ "holeNo": 214, "index": 2, "entityId": "nba-sas", "rawText": "san antonio spur" }
// response
{ "correct": true, "canonicalName": "San Antonio Spurs", "tier": "ALL_STAR", "yards": 85, "totalYards": 225 }
```

Idempotent per `(play, index)`: a second swing for the same shot returns the first result.

### `GET /api/hole/:holeNo/answers`

Returns every correct answer per prompt **only if this player's play for that hole is complete** (or the hole is in the past). Otherwise `403`.

## Rarity scoring

For prompt *p*, answer *a*, at swing time:

```
share(a) = (count(a) + K · prior(a)) / (N + K)
```

- `count(a)` — correct picks of *a* so far today
- `N` — total correct picks for *p* so far today
- `prior(a)` — editorial prior share (sums to 1 across the prompt's answers), seeded from Wikipedia pageviews
- `K` — prior strength in pseudo-picks; start at **200**

Early in the day the prior dominates; after a few thousand plays the crowd does. The tier from `share(a)` is **locked** on the shot row and never recomputed for that player.

Thresholds live in `src/lib/scoring.ts`:

```ts
export const TIERS = [
  { id: 'BALL_KNOWER',  maxShare: 0.01, yards: 100 },
  { id: 'ALL_STAR',     maxShare: 0.04, yards: 85 },
  { id: 'STARTER',      maxShare: 0.10, yards: 70 },
  { id: 'ROLE_PLAYER',  maxShare: 0.25, yards: 55 },
  { id: 'BENCH_WARMER', maxShare: 1.00, yards: 40 },
] as const;
export const OUT_OF_BOUNDS = { id: 'OUT_OF_BOUNDS', yards: 0 } as const;
```

The "longer than X% of today's players" line uses the distribution of completed totals (a histogram row per hole, updated on completion).

## Matching / auto-correct

1. **Normalize:** lowercase, strip accents (`NFD` + remove marks), drop punctuation, collapse spaces, drop leading "the".
2. **Exact alias hit** on the normalized string → that entity.
3. **Fuzzy:** Jaro-Winkler (or Damerau-Levenshtein ratio) over normalized names + aliases; best score ≥ 0.88 is suggested. Prefer prefix matches while the player is still typing.
4. Tie-break by entity **popularity within the pool**, never by whether it's a correct answer.

The same normalizer runs on the server for raw-text swings. Put it in `src/lib/match.ts` with unit tests for every alias case in `data/`.

## Data model

See `db/schema.sql`. In short:

- `pools` / `entities` / `entity_aliases` — the universe of nameable things per pool
- `holes` / `prompts` / `prompt_answers` (+ `prior_share`) — the daily content
- `pick_counts` — `(prompt_id, entity_id) → count`, upserted per correct swing
- `plays` / `shots` — one play per player per hole; shots lock tier and yards
- `templates` / `review_queue` — content pipeline staging

### Write load

Every correct swing increments one `pick_counts` row. D1 handles moderate traffic fine. If the midnight spike causes contention, move counters into one **Durable Object per hole** (in-memory counts, flushed to D1 every few seconds). Keep the counter behind an interface (`src/lib/server/counters.ts`) so the swap is local.

## Security and fairness

- Answer lists live only server-side until a play is complete (hard rule).
- Server-side clock per prompt; late swings are Out of Bounds.
- Rate limit `POST /api/swing` per IP and per `playerId` (Workers rate-limiting binding).
- A determined player can still look answers up in another tab — that's accepted. It's a casual daily game; the clock is the main deterrent.
- Never trust client-sent tier/yards; the server computes everything.

## Client state

- `localStorage`: `playerId`, today's in-progress play (shot results, current index), streak and stats.
- Wrap all storage access in try/catch (private mode can throw); the game must still work without it (just no streaks).

## Environments

| Env | Where | Data |
|---|---|---|
| local | `wrangler pages dev` / `pnpm dev` with local D1 | `data/sample-hole.json` seed |
| preview | Cloudflare Pages preview per PR | staging D1 |
| production | custom domain | production D1 |
