# 06 — Decision log

Short records of choices that were debated. Add a new entry when a decision changes; don't rewrite old ones.

---

### D1 — Golf as the distance metaphor (2026-10-25)

**Chose:** a 500-yard golf hole; each answer is a swing.
**Over:** a football drive down the field, a home-run distance meter.
**Why:** golf gives a natural vocabulary (tee off, swing, out of bounds, the card, driving range), a fixed target to finish (the cup) and a clean way to show a wrong answer (OB). Mirrors Farflung's 500 km max.

### D2 — Every correct answer scores (2026-10-25)

**Chose:** minimum 40 yds for any correct answer.
**Over:** zero points for the most common answers.
**Why:** casual fans should never feel punished for knowing the obvious; they're only outscored.

### D3 — Minimal shot result screen (2026-10-25)

**Chose:** show only the answer, tier, yards and the ball flight after each prompt.
**Over:** showing pick %, the tier ladder, most-picked and rarest answers.
**Why:** keeps the round fast and the reveal focused; the full answer lists are the reward at the end.

### D4 — Auto-correct, not autocomplete (2026-10-25)

**Chose:** free typing with a single closest-match suggestion drawn from the whole entity pool.
**Over:** a dropdown list of suggestions.
**Why:** a list turns recall into recognition and makes the game easier than it should be. Matching against the whole pool (right and wrong answers) means the suggestion can't leak correctness.

### D5 — Expandable answer lists on the card (2026-10-25)

**Chose:** each scorecard row expands to show all correct answers.
**Why:** the "oh, I forgot about him" moment is the best part of rare-answer games, and it teaches deep cuts for tomorrow.

### D6 — Lock tier at swing time (2026-10-25)

**Chose:** a shot's tier is fixed when the player swings.
**Over:** recomputing tiers through the day (Immaculate Grid style).
**Why:** a shared card should never change after it's posted.

### D7 — SvelteKit (2026-10-25)

**Chose:** SvelteKit + TypeScript.
**Over:** Next.js/React, Vite + Preact.
**Why:** smallest bundles for an app this size, prerendering for the landing pages, first-class Cloudflare adapter. Preact remains the fallback if a React model is preferred.

### D8 — Cloudflare over Vercel + Supabase (2026-10-25)

**Chose:** Cloudflare Pages + Workers + D1 + KV + Cron.
**Why:**
- one platform for static, API, DB, cache and the daily cron
- free tier permits commercial use (Vercel Hobby is non-commercial only — ads/sponsors would force Pro)
- no idle-pausing of the database during development (Supabase free projects pause after a week of low activity)
- edge execution near every player, near-zero cold starts

**Trade-offs accepted:** SQLite handles concurrent writes less well than Postgres (mitigation: Durable Object counters, see `03-architecture.md`); no built-in auth/realtime. If social features arrive, keep hosting on Cloudflare and consider moving just the database to Supabase.

### D9 — Prompts from data, not from an LLM (2026-10-25)

**Chose:** template + query pipeline over open data; human review.
**Why:** a single invented or missing answer breaks trust in the game. LLMs may phrase prompts, never supply answer lists.

### D10 — Sample prompts avoid volatile answer lists (2026-10-25)

Prompts whose answers can change soon (a season in progress, an award not yet given, a tournament just played) are scheduled only after the list is settled. Example: "World Cup winner" was replaced with "Summer Olympics host country" in the sample hole.

### D11 — M0 scaffold details (2026-10-25)

**Chose:**
- `wrangler.jsonc` over `wrangler.toml` — it's what `sv create` and current Wrangler generate, and it gets a JSON schema for editor checks.
- Fonts from Fontsource's prebuilt latin + latin-ext woff2 subsets (with `unicode-range`), copied into `static/fonts/`. Graduate ships latin only, which is fine — it's uppercase display text.
- D1 migrations and `db:*` scripts deferred to M2 (the schema is still a draft and nothing reads the DB yet).
- Playwright runs locally only for now; CI runs `check`, `lint`, `test` as the roadmap asks.
- Prettier ignores the pre-existing `docs/`, `design/`, `data/`, `db/` and Markdown so they stay as authored.

### D12 — M1 prototype details (2026-10-26)

**Chose:**
- **Offline API stand-in.** `src/lib/api.ts` has the same function shapes as the M2 endpoints (`getHole`, `getPool`, `swing`, `getAnswers`) but reads `data/sample-hole.json`. M2 swaps the bodies for `fetch`; screens don't change. Tiers come from the prior alone (`blendedShare` with zero picks).
- **Accepted M1 exception to hard rule 1:** the sample file, answers included, is a lazy JS chunk loaded by `/play` and `/card`. The home page imports only `src/lib/today.ts` (hole number, date), so it never pulls answers. Goes away in M2.
- **Auto-correct ties break alphabetically**, not by pool order (the sample pools list correct answers first, so pool order would leak) and not by popularity (no popularity data until M3).
- **Starter arc color `#8CCB9F`** (`--bk-arc-starter`): the Starter tier green is invisible on the fairway.
- **Share squares:** Ball Knower 🟨, All-Star 🟦, Starter 🟩, Role Player 🟫, Bench Warmer ⬜, Out of Bounds 🟥. Role Player's pale green has no emoji square, so it borrows brown.
- **Deferred:** the percentile line on the card ("longer than X% of today's players") needs the server (M2); short scorecard labels ("Non-QB NFL MVP") need a `short` field on prompts (M3 pipeline), so the card shows the full prompt text; Driving Range shows as "SOON" (M4).

### D13 — Krillion/Farflung-style progression and reveal (2026-10-26)

**Chose:** the between-prompt and shot-reveal flow from the Krillion and Farflung recordings, translated to golf. Each prompt tees up with a 3-second countdown before the input and clock appear. The result screen has a carry meter whose tier gates light up as the ball passes them, a tier stamp that upgrades with each gate and then slams down with a flash in the tier color, and a one-line flavor for the tier. NEXT SHOT appears only after the reveal settles. Progress pips in the top bar fill in with each shot's tier color.
**Over:** D3's minimal result screen (answer, tier banner popping in on landing, ball flight).
**Why:** the reveal is the payoff of every shot. Passing the cheaper tiers before landing on yours makes the rarity visible without numbers, and the countdown gives a beat to read the prompt before the clock runs.
**Still true from D3:** no pick percentages, no other answers, no most-picked/rarest lists mid-round. The gates show only tier names and yardages, which How to Play already shows.
**Not adopted:** Krillion's "submit again to confirm" step for auto-corrected answers. Swing still submits the corrected name in one press (D4). Worth revisiting after playtests.

### D14 — Desktop gets its own layout (2026-10-27)

**Chose:** at 960px and wider, each screen splits into a stage (the fairway, carry meter, masthead or hole map) and a 400px side panel (prompt, answer, result card, actions), inside a 1120px frame. Below 960px nothing changes. Tokens: `--bk-wide-max`, `--bk-panel-width`, `--bk-gutter-wide`. The breakpoint is written as `min-width: 960px` in each stylesheet, since CSS custom properties can't be used in media queries.
**Over:** the earlier design-system rule "on desktop, center the 390–430px game column".
**Why:** on a laptop the phone column left most of the screen empty and squeezed the fairway, which is the part of the game that animates. The split mirrors Farflung's map + side panel. Every element keeps the same DOM order as on mobile (stage/panel wrappers are `display: contents` on phones), so screen-reader and tab order are the same on both.

### D15 — M2 server details (2026-10-28)

**Chose:**
- **No Cron Trigger: lazy publish.** Cloudflare Pages Functions support neither `triggers` nor the rate-limiting binding (wrangler's Pages config whitelist). Today's hole is cached in KV under its UTC date, so the first `GET /api/hole/today` after 00:00 UTC reads D1, flips `holes.status` (live/past) and writes KV. If no hole is scheduled for a day, the latest earlier one repeats. A separate cron Worker (or moving from Pages to Workers + static assets) can warm the cache later; nothing depends on it.
- **Rate limiting per isolate.** A fixed one-minute window in memory, per IP and per player. Best effort — isolates don't share it. Add a WAF rate-limiting rule on `/api/*` in production.
- **Bindings via `cloudflare:workers`.** The SvelteKit 3 Cloudflare adapter no longer passes `platform.env`; server code imports `env` from `cloudflare:workers` (the adapter provides a dev-time stand-in backed by `.wrangler/` state).
- **The server clock is the clock.** `POST /api/prompt/:i/start` returns `elapsedMs` since the prompt was first served; the client counts down from that, so clock skew and reloads don't matter. Shots must be served in order.
- **Blank swings go to the server** so the play row completes and the answers unlock.
- **Pool URLs carry the version** (`/api/pool/:id?v=`), so "immutable" caching is safe; `poolVersion` rides on each prompt in the hole payload.
- **Seed wipes everything.** `pnpm db:seed` loads `data/sample-hole.json` as today's hole (`--date=` to override), deletes every play and pick count, and clears the HOLES KV namespace. Playwright reseeds before every run and runs with one worker, since tiers depend on earlier picks.
- **Card without answers.** If the server won't confirm the play is finished (offline, or local storage from a reseeded database), the card still shows the round, with "answers unavailable" in each row.
- **Deferred:** the percentile line on the card (`hole_totals` is filled on completion; nothing reads it yet).
