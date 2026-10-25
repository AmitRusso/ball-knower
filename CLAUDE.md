# CLAUDE.md — Ball Knower

Context for Claude Code. Read this first, then the doc relevant to the task.

## What this is

A daily, web-served sports trivia game. Five prompts a day, each with many correct answers; rarer correct answers score more yards on a 500-yard golf hole. Full spec: `docs/01-game-design.md`.

## Where things are decided

| Topic | Source of truth |
|---|---|
| Rules, tiers, scoring, screen flow, edge cases | `docs/01-game-design.md` |
| Look and feel, tokens, components, animation | `docs/02-design-system.md`, `design/tokens.css`, `design/mockups/` |
| Stack, API, data model, rarity math, security | `docs/03-architecture.md`, `db/schema.sql` |
| Prompt generation | `docs/04-content-pipeline.md` |
| What to build next | `docs/05-roadmap.md` |
| Why we chose X over Y | `docs/06-decisions.md` |

If code and docs disagree, ask before changing either. When a decision changes, update the doc and add an entry to `docs/06-decisions.md`.

## Stack

- **App:** SvelteKit + TypeScript (strict), `@sveltejs/adapter-cloudflare`
- **Hosting:** Cloudflare Pages + Workers
- **Data:** Cloudflare D1 (SQLite), Workers KV for today's hole, Cron Trigger at 00:00 UTC
- **Styling:** plain CSS with the custom properties in `design/tokens.css`. No Tailwind, no UI kit.
- **Animation:** inline SVG + CSS / Web Animations API. No animation library.
- **Fonts:** Graduate, Archivo, Space Mono — self-hosted, subsetted woff2
- **Tests:** Vitest (unit), Playwright (full five-shot flow)
- **Content pipeline:** Python 3.12+ in `pipeline/` (not yet created)
- **Package manager:** pnpm

## Commands

```bash
pnpm dev            # vite dev server (http://localhost:5173)
pnpm check          # wrangler types --check + svelte-check (tsc)
pnpm lint           # eslint + prettier --check
pnpm format         # prettier --write
pnpm test           # vitest (unit, *.spec.ts / *.test.ts under src/)
pnpm test:e2e       # playwright (e2e/*.e2e.ts) against build + wrangler pages dev on :4173
pnpm preview        # wrangler pages dev on the built output (D1/KV bindings available)
pnpm cf:types       # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm deploy         # build + wrangler pages deploy (needs `wrangler login`)
```

Added in M2: `pnpm db:migrate` (wrangler d1 migrations apply, local, from `db/migrations/`) and `pnpm db:seed` (load `data/sample-hole.json` into local D1).

Notes: SvelteKit 3 — Kit config lives in `vite.config.ts` (no `svelte.config.js`); `#lib/*` is the import alias for `src/lib/*`. Cloudflare config is `wrangler.jsonc` (bindings `DB` → D1, `HOLES` → KV; placeholder IDs until M2). `src/lib/styles/tokens.css` is a verbatim copy of `design/tokens.css` — edit the design file and re-copy; a unit test enforces they match.

## Hard rules

1. **Never send answer lists to the browser before the player has finished the hole.** Prompts go out with text, league and entity pool only. `GET /api/hole/:n/answers` must check the player has completed the hole.
2. **Auto-correct matches against the whole entity pool** (every NBA franchise, every MLB pitcher), never against the correct answers only. Otherwise the suggestion reveals correctness.
3. **A shot's tier is locked at swing time** and never recalculated for that player.
4. **Answer lists come from data, not from an LLM.** An LLM may phrase prompts; it must not produce or "fill in" answer lists.
5. **Performance budget:** first-load JS < 50 KB gzipped, LCP < 1.5 s on mid-range mobile, swing API < 100 ms p95. Check bundle size before adding any dependency.
6. **Accessibility:** real `<button>`/`<a>`/`<input>`+`<label>`, visible focus, 4.5:1 text contrast, `prefers-reduced-motion` disables the ball flight (jump straight to the landing spot).
7. No cookies, no third-party trackers. Player identity is a random UUID in localStorage.

## Conventions

- TypeScript strict; no `any` without a comment explaining why.
- Shared types for API payloads live in `src/lib/types.ts` and are imported by both routes and client.
- Server-only code in `src/lib/server/` (SvelteKit enforces it never reaches the client — rule 1 depends on this).
- Tier thresholds and yardages live in one constants file (`src/lib/scoring.ts`) — never hard-code 40/55/70/85/100 elsewhere.
- Copy uses the game's vocabulary: tee off, swing, shot, hole, card, out of bounds, driving range.
- Commit style: Conventional Commits (`feat:`, `fix:`, `docs:` …).

## Current state

M0 scaffold done: SvelteKit app with tokens, self-hosted fonts, a styled placeholder home page, CI (check/lint/test). Not yet deployed to Cloudflare Pages. Next step: finish the M0 deploy, then **Milestone 1** in `docs/05-roadmap.md`.
