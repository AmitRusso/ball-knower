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
