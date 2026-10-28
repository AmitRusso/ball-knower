# 05 — Roadmap

Each milestone ends with something playable or deployable. Tick boxes as you go.

## M0 — Repo and scaffold

- [x] `pnpm dlx sv create` → SvelteKit, TypeScript, Prettier, ESLint, Vitest, Playwright
- [x] `@sveltejs/adapter-cloudflare`, `wrangler.jsonc` with D1 + KV bindings (local only for now)
- [x] Copy `design/tokens.css` into `src/lib/styles/`, import globally
- [x] Self-host the three fonts (subset woff2) in `static/fonts/`
- [x] Fill in the **Commands** section of `CLAUDE.md`
- [x] GitHub Actions: `check`, `lint`, `test` on every PR
- [x] Deploy an empty page to Cloudflare Pages

**Done when:** a styled "BALL KNOWER" page is live on a `*.pages.dev` URL and CI is green.

## M1 — Playable offline prototype

Hard-code one hole from `data/sample-hole.json`; no server yet.

- [x] Screens from `design/mockups/`: Home, How to Play, Prompt, Shot Result, Card
- [x] `FairwayTracker` component (shared) with the geometry from `02-design-system.md`
- [x] Ball flight animation + `prefers-reduced-motion`
- [x] 45-second timer, auto-swing on timeout
- [x] `src/lib/match.ts` (normalize + aliases + fuzzy) with unit tests; `AutoCorrectCard`
- [x] `src/lib/scoring.ts` — tiers from the sample priors
- [x] Expandable scorecard rows, share text + Web Share API
- [x] localStorage: resume mid-round, streak

**Done when:** you can play a full hole on your phone and share the result. Show it to five friends.

## M2 — Server and real rarity

- [ ] D1 migrations from `db/schema.sql`; seed script for the sample hole
- [ ] `GET /api/hole/today`, `GET /api/pool/:id`, `POST /api/prompt/:i/start`, `POST /api/swing`, `GET /api/hole/:n/answers`
- [ ] Rarity blend (`K = 200`), tier lock on `shots`
- [ ] Server-side clock, idempotent swings, rate limiting
- [ ] KV caching of hole + pools; cron publishes the next hole at 00:00 UTC
- [ ] Playwright: full round against local D1; test that answers are never in any pre-completion response

**Done when:** two people on different phones play the same hole and see rarity tiers driven by real picks.

## M3 — Content pipeline

- [ ] `pipeline/` Python project; Wikidata client; pageviews client
- [ ] 10+ templates across NFL, NBA, MLB, NHL, soccer, Olympics
- [ ] Filters from `04-content-pipeline.md`; review CLI
- [ ] Export approved prompts → D1; schedule 30 days ahead
- [ ] Entity pools with aliases for each league

**Done when:** a month of holes is approved and scheduled.

## M4 — Polish and performance

- [ ] PWA manifest, icons, service worker (shell + fonts cached)
- [ ] OG image per shared card
- [ ] Driving Range (unlimited, random past prompts)
- [ ] Accessibility pass (keyboard, screen reader, contrast, reduced motion)
- [ ] Perf budget in CI: bundle-size check (< 50 KB gzipped JS), Lighthouse CI
- [ ] Cloudflare Web Analytics; error logging

## M5 — Launch

- [ ] Domain, privacy page, contact/feedback link
- [ ] Counter hardening (Durable Object per hole) if the midnight spike needs it
- [ ] Post to r/nfl, r/nba, r/baseball, sports Discords; Product Hunt

## Later

- Accounts (optional) and friend leaderboards
- League-specific holes, weekly "major" (9 prompts)
- Localization
