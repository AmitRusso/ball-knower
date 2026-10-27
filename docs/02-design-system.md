# 02 — Design system

The look: a **retro clubhouse**. Mowed fairway stripes, a hand-operated scoreboard, varsity lettering, ticket stubs and trading cards. Semi-retro like Krillion and Farflung — characterful, not kitsch.

Reference screens: `design/mockups/` (open `index.html`). Tokens: `design/tokens.css`.

## Color

| Token | Hex | Use |
|---|---|---|
| `--bk-green-900` | `#0E2618` | Deepest green: shadows, cup, tracker outlines |
| `--bk-green-800` | `#123322` | Tracker card background |
| `--bk-green-700` | `#173D2A` | Main background (fairway) |
| `--bk-green-650` | `#1A4530` | Mowing stripe (alternates with 700) |
| `--bk-green-500` | `#2C6644` | Fairway band, card borders on dark |
| `--bk-cream` | `#F3EEDF` | Scoreboard white: text on green, light surfaces |
| `--bk-cream-200` | `#E8E1CC` | Answer chips, share block |
| `--bk-cream-50` | `#FBF8EE` | Expanded row background |
| `--bk-ink` | `#14201A` | Text on cream, table headers |
| `--bk-ink-muted` | `#4F554C` | Secondary text on cream (5.9:1) |
| `--bk-gold` | `#F2B632` | Flag gold: primary buttons, highlights, Ball Knower tier |
| `--bk-red` | `#A8321F` | Clock, Out of Bounds |

### Tier colors

| Tier | Background | Text |
|---|---|---|
| Bench Warmer | `#D9D4C4` | ink |
| Role Player | `#A9C4A0` | ink |
| Starter | `#2E6B45` | cream |
| All-Star | `#1E4E8C` | cream |
| Ball Knower | `#F2B632` | ink |
| Out of Bounds | `#A8321F` | cream |

On dark backgrounds, arcs use lighter variants: All-Star `#7FAEEA`, Starter `#8CCB9F`, Out of Bounds `#E2735E` (Starter added in M1 — its tier green is invisible on the fairway). Tiers also differ in lightness (not hue alone), so they read in grayscale; the tier name is always printed alongside the color.

## Typography

| Role | Font | Notes |
|---|---|---|
| Display | **Graduate** | Varsity/collegiate. Logo, tier banners, big numbers, buttons. Uppercase only. |
| Body | **Archivo** 400/600/800 | Prompts, answers, explanations |
| Labels / data | **Space Mono** 400/700 | Scoreboard labels, yardages in tables, timer, chips. Uppercase + letter-spacing 0.08–0.12em. |

Self-host as subsetted woff2 (Latin + Latin-1 + accented names like Jokić). `font-display: swap` for body, `optional` for Graduate to avoid layout shift.

Scale (px): 11 · 12 · 13 · 14 · 15 · 17 · 22 · 26 · 28 · 36–44 (tier banner) · 66–76 (logo, total yards).

## Surfaces and motifs

- **Fairway background:** vertical stripes, `repeating-linear-gradient(90deg, green-650 0 28px, green-700 28px 56px)`.
- **Hard drop shadows**, no blur: `box-shadow: 0 6px 0 var(--bk-green-900)` on primary buttons and cards. This is most of the retro feel.
- **Ticket stub:** cream card split into columns by `2px dashed` dividers (home screen "today's card").
- **Trading card:** cream outer frame, inner border in the tier color, full-bleed tier banner at the bottom (shot result).
- **Scorecard:** 2px ink border, ink header bar, thin cream-200 row rules.
- **Logo text-shadow:** `4px 4px 0 green-900`.
- Radius: 3px chips, 4–6px cards/buttons, 999px timer pill.
- No gradients (other than the stripe pattern), no blur, no glassmorphism, no emoji in UI.

## Components

| Component | Notes |
|---|---|
| `TopBar` | `HOLE 214` · `ShotPips` · timer pill (red) |
| `ShotPips` | Five 12px squares, played shots filled in their tier color, current one 16px with a gold outline; `SHOT 3 OF 5` caption in gold 10px mono below |
| `FairwayTracker` | SVG. Fairway band, tee, yard markers (100–400), flag + cup at 500, past shots as dashed arcs, current ball. Header: `140 YDS` (gold) / `360 TO PIN`. Shared by prompt, result and card screens. |
| `PromptCard` | Cream card, league chip (ink bg, gold text), prompt in Archivo 800 ~25px, rule note in muted 13px |
| `AnswerInput` | 52px tall, 3px gold border, label `YOUR ANSWER` |
| `AutoCorrectCard` | Single suggestion. Dashed gold border on dark green, check icon, `AUTO-CORRECT` label, canonical name in 17px 800. Hidden when no match. |
| `PrimaryButton` | Gold, Graduate 26–28px, 3px dark border, hard shadow. Labels: TEE OFF, SWING, NEXT SHOT |
| `SecondaryButton` | 2px cream (or ink) outline, Space Mono 13px bold |
| `TierCard` | Trading-card result: YOUR ANSWER label, name, prompt reminder, tier stamp + `+85 YDS` (part of `ShotReveal`) |
| `CarryMeter` | Dark green strip, `CARRY` label, a 0–100 yd track with dashed gates at each tier's yardage; tier names alternate above/below; a gate lights in its arc color when passed, the landing gate goes solid (part of `ShotReveal`) |
| `TierChip` | Space Mono 11–12px bold, tier colors |
| `ScorecardRow` | `<details>`: summary = #, prompt, answer, tier chip, yards, chevron; body = all correct answers as chips, player's answer gold with ink border |
| `ShareBlock` | `BALL KNOWER #214 · 325 YDS` + five 22px tier squares |

## The tracker geometry

The tracker SVG uses a `342 × ~100` viewBox. Yards map to x linearly:

```
x(yds) = 12 + yds × 0.628      // tee at x=12, pin at x=326
```

Each shot is a quadratic Bézier from `x(start)` to `x(end)` on the fairway's center line, with its control point raised in proportion to distance (`peak ≈ 10 + distance × 0.2`, control y = groundY − 2 × peak). Out of Bounds arcs bend off the fairway and end with an ✕ below the dashed OB line.

## Motion

- **Tee-up (before each prompt):** the prompt card deals in (translate-y 24px → 0, 350 ms); a big gold Graduate count 3 → 2 → 1 (each scales in from 1.6, 300 ms); the input and clock appear at 0.
- **Ball flight (shot result):** the new arc draws itself (`stroke-dashoffset` 1 → 0 on a `pathLength="1"` path) while the ball follows it; one rAF clock (`src/lib/reveal.ts`) drives the arc, the carry meter and the stamp. Duration `900 + 12 × yards` ms (1.38 s for Bench Warmer, 2.1 s for Ball Knower; 1.2 s for OB), cubic ease-out. A small shadow ellipse waits at the landing spot.
- **Tier stamp:** striped empty box until the first gate; then the tier name and color switch at each gate passed (120 ms color transition). 150 ms after landing it slams (scale 1.5, −4° → 1, 220 ms, overshoot) and the card flashes a 14px ring in the tier color (450 ms).
- Yard counters (stamp and tracker header) tick up during the flight.
- 450 ms after the slam: the flavor line fades in (300 ms), then NEXT SHOT rises in (12px, 200 ms) and takes focus.
- **`prefers-reduced-motion`:** no flight, no slam; the final arc, gate, stamp, flavor and button appear immediately.
- No looping animations in the real app (the mockup loops only for demo purposes).

## Layout

- Mobile-first, designed at **390 × 844**. Single column (max 430px), 24px side padding. Below 960px (phones, tablets) the game stays in this centered column.
- **Desktop (min-width: 960px):** the screen widens to `--bk-wide-max` (1120px) with 48px gutters and splits into a **stage** on the left and a **side panel** (`--bk-panel-width`, 400px) on the right, 40px apart, vertically centered. Fairway stripes fill the rest.
  - **Home:** masthead (logo 112px) and hero arc on the left; ticket stub, TEE OFF and secondary buttons in the panel.
  - **Prompt:** the fairway tracker is the stage; prompt card, answer, auto-correct and SWING (right under the answer) are the panel.
  - **Shot result:** fairway tracker over the carry meter is the stage; trading card, flavor and NEXT SHOT are the panel.
  - **Card:** the fairway header (total, hole map) is a sticky 400px left column; scorecard, share block and buttons fill the right.
  - **How to Play:** a 960px sheet with the rules on the left and the ladder beside them.
- On phones the primary action sits at the bottom of the screen within thumb reach; on desktop it sits directly under the content it acts on.
- Touch targets ≥ 44px.

## Accessibility

- Text contrast ≥ 4.5:1 (all token pairs above pass).
- Tracker SVG has `role="img"` and an `aria-label` describing ball position ("Ball at 225 of 500 yards").
- Tier changes announced via an `aria-live="polite"` region on the result screen.
- Timer: visible, and announced at 10 s remaining.
- Scorecard rows use native `<details>/<summary>` (keyboard and screen-reader friendly for free).
