# Design

- **`mockups/`** — the five screens as standalone HTML at 390px mobile width. Open `mockups/index.html` to see them side by side; buttons link between screens. The shot-result ball flight loops for demo purposes only.
- **`tokens.css`** — colors, fonts, tier colors, shadows, motion as CSS custom properties. Copy into `src/lib/styles/` in Milestone 0.
- Full spec: [`../docs/02-design-system.md`](../docs/02-design-system.md).

The mockups load fonts from Google Fonts for convenience; the real app self-hosts them.

## Screens

| # | File | Shows |
|---|---|---|
| 1 | `01-home.html` | Logo, today's card (5 prompts · 45s · 500 yds), Tee Off, How to Play, Driving Range, streak |
| 2 | `02-how-to-play.html` | Rules and the tier ladder |
| 3 | `03-prompt.html` | Timer, fairway tracker, prompt card, free-text answer, single auto-correct suggestion, Swing |
| 4 | `04-shot-result.html` | Answer, tier banner, +yards, animated ball flight |
| 5 | `05-card.html` | Total, hole map, scorecard with expandable all-answers rows, share block |

## Source canvas

The mockups were exported from the Ball Knower design canvas on claude.ai (private to its owner). Edit the canvas and re-export, or treat these HTML files as the reference from now on — they won't stay in sync automatically.
