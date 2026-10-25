# Ball Knower ⛳

**The daily drive.** A daily sports trivia game where the rarer your right answer, the farther your ball flies.

Every day, everyone gets the same five sports prompts — *"Name a non-QB NFL MVP"*, *"Name a 300-win pitcher"*. Each prompt has many correct answers. Obvious answers barely move the ball; the deep cuts send it down the fairway. The hole is 500 yards. Five perfect answers and it's in the cup.

Inspired by [Krillion](https://krillion.io) (rare-answer trivia) and [Farflung](https://farflung.game) (the same idea on a world map), and by the rarity score in [Immaculate Grid](https://www.sports-reference.com/immaculate-grid/).

> **Status:** Milestone 0 (scaffold) — the SvelteKit app is set up; gameplay starts in M1. See [`docs/05-roadmap.md`](docs/05-roadmap.md).

---

## How it plays (short version)

| Tier | Picked by | Yards |
|---|---|---|
| Bench Warmer | 25%+ of players | 40 |
| Role Player | 10–25% | 55 |
| Starter | 4–10% | 70 |
| All-Star | 1–4% | 85 |
| **Ball Knower** | under 1% | 100 |
| Out of Bounds | wrong or blank | 0 |

- 5 prompts a day, same for everyone, new hole at **midnight UTC**
- **45 seconds** per prompt
- Free typing with a single **auto-correct** suggestion (no answer list)
- After each swing: your answer, its tier, and the ball flying down the fairway
- After the round: a scorecard where every row expands to show **all** correct answers

Full rules: [`docs/01-game-design.md`](docs/01-game-design.md)

## Stack

SvelteKit + TypeScript on **Cloudflare** (Pages + Workers + D1 + KV + Cron). Plain CSS, inline SVG animation, self-hosted fonts. Python + Wikidata for the content pipeline. Details and reasoning: [`docs/03-architecture.md`](docs/03-architecture.md).

**Performance budget:** < 50 KB gzipped JS on first load · usable in < 1.5 s on mobile · swing response < 100 ms.

## Repo map

```
ball-knower/
├── CLAUDE.md                 ← context for Claude Code (read first)
├── docs/
│   ├── 01-game-design.md     ← the idea, rules, scoring, screen flow, edge cases
│   ├── 02-design-system.md   ← palette, type, components, animation, a11y
│   ├── 03-architecture.md    ← stack, request flow, API, rarity math, security
│   ├── 04-content-pipeline.md← generating prompts from open sports data
│   ├── 05-roadmap.md         ← milestones M0–M5 with checklists
│   └── 06-decisions.md       ← why we chose what we chose
├── design/
│   ├── README.md
│   ├── tokens.css            ← colors, fonts, tiers as CSS custom properties
│   └── mockups/              ← the five screens as standalone HTML (open index.html)
├── db/
│   └── schema.sql            ← draft Cloudflare D1 (SQLite) schema
└── data/
    └── sample-hole.json      ← one full hole (5 prompts + answer lists) for M1
```

## Getting started

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

`CLAUDE.md` lists every command. Open `design/mockups/index.html` in a browser to see the target screens.
