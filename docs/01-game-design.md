# 01 — Game design

## The idea

Most trivia rewards knowing *the* answer. Ball Knower rewards knowing an answer **nobody else thought of**.

Each day's five prompts each have many correct answers — "Name a 300-win pitcher" has 24. Anyone can say Nolan Ryan. A real ball knower says Mickey Welch. The game measures that difference and turns it into distance on a golf hole.

The name is the top tier: answer something under 1% of players gave and you're a **Ball Knower**.

### Inspirations

- **Krillion** — daily rare-answer trivia; points move a "dive" deeper.
- **Farflung** — the same idea on a world map; rarer countries travel farther (max 500 km).
- **Immaculate Grid** — sports grid with a crowd-sourced rarity score.

Ball Knower is the sports version of Krillion/Farflung, with golf as the distance metaphor.

## Core loop

1. **Tee off** — open today's hole (same five prompts for everyone).
2. **Tee up** — the prompt appears on its own with a 3-second countdown ("the clock starts in 3"); the input and the 45-second clock appear when it hits zero.
3. **Prompt** — type an answer, accept the auto-correct, **swing**. 45 seconds.
4. **Shot result** — the ball carries past each tier gate while the tier stamp upgrades, then the stamp lands. NEXT SHOT appears once it has.
5. Repeat for shots 2–5.
6. **The card** — total yards, hole map of all five shots, expandable list of every correct answer, share.

## Rules

1. **Five prompts, one hole.** Everyone gets the same five sports prompts each day. The hole is 500 yards. A new hole opens at 00:00 UTC.
2. **Any right answer counts.** Each prompt has many correct answers. Type one and swing before the 45-second clock runs out.
3. **Rarer flies farther.** A correct answer's yardage depends on the share of today's players who gave the same answer:

   | Tier | Share of players | Yards |
   |---|---|---|
   | Bench Warmer | 25% or more | 40 |
   | Role Player | 10% – under 25% | 55 |
   | Starter | 4% – under 10% | 70 |
   | All-Star | 1% – under 4% | 85 |
   | Ball Knower | under 1% | 100 |
   | Out of Bounds | wrong answer, blank, or time ran out | 0 |

4. **Sink it.** Five Ball Knower answers = 500 yards = ball in the cup.
5. **One round per day.** The daily hole can be played once. **Driving Range** (unlimited mode) serves random past prompts one ball at a time and doesn't affect streaks, stats or anyone's rarity: a range shot is scored against that hole's picks but never counted. The answers show after each ball.

### Why every correct answer scores

An obvious answer is never punished — it's only outscored. That keeps casual fans playing while giving experts something to chase.

### Out of bounds

Shown as a shot that hooks off the fairway. The ball stays where it was — the next shot starts from the same spot (this mirrors real golf's stroke-and-distance rule, so it reads naturally).

## Answer input and auto-correct

- **No answer list or dropdown.** The player types freely.
- As they type, the closest match from the prompt's **entity pool** (e.g. *every* NBA franchise, *every* MLB pitcher) is shown as a single **auto-correct** card.
- **Swing submits the auto-corrected name.** If there's no match, the raw text is submitted (and will almost certainly be Out of Bounds).
- The pool contains right and wrong answers alike, so the suggestion never reveals correctness. (Hard rule — see `CLAUDE.md`.)
- Matching is forgiving: case, accents, punctuation, common nicknames and historical names (Minneapolis Lakers → Los Angeles Lakers) are handled through an alias table, then fuzzy matching.

## Shot result screen (after each prompt)

The reveal follows Krillion (the answer sinks past labeled depth lines) and Farflung (the tier stamp flickers up, then lands). In order:

1. The ball flies. A **carry meter** under the card shows the five tier gates at their yardages (40 Bench Warmer … 100 Ball Knower); each gate lights up as the ball passes it, and the **tier stamp** on the card upgrades to match. The yard counters tick up.
2. The ball lands on its own tier's gate. Out of Bounds hooks off and passes no gate.
3. The stamp **slams** down and the card flashes in the tier color.
4. A one-line **flavor** for the tier fades in ("A deep cut. Pure contact.").
5. **NEXT SHOT** appears and takes focus. The progress pips at the top fill in with this shot's tier color only now.

It still does **not** show pick percentages, the most-picked or rarest answers, or any other answers. The gates show only tier names and yardages, which How to Play already lists.

## The card (end of round)

- Total yards, yards short of the pin, percentile vs. today's players
- Hole map: all five shot arcs, color-coded by tier, OB shot drawn hooking off the fairway
- Scorecard rows: shot #, prompt, your answer, tier chip, yards
- **Each row expands** to show *all* correct answers for that prompt, with yours highlighted. Wrong answers get a one-line explanation where useful.
- Share block: `BALL KNOWER #214 · 325 YDS` plus five tier-colored squares and a link to the shared card (`/c/214/KBAOK`), whose preview image shows the card (text + Web Share API)
- Countdown to the next hole, link to Driving Range

## Prompt design guidelines

A good prompt:

- has **5–60 correct answers** (fewer leaves no room for rare picks; more and nothing feels special)
- has a **spread of fame** — a few household names, a long tail of deep cuts
- has a **crisp, checkable definition** ("AP NFL MVP", not "best QB ever")
- states edge-case rules in its note line ("Relocated franchises count")

A good daily hole:

- covers several leagues (e.g. NFL, NBA, MLB/NHL, soccer, plus one "any sport" wildcard)
- mixes difficulty: no hole where all five prompts are obscure
- avoids two prompts with overlapping answers

## Rarity: day one vs. later

Before many people have played, raw shares are noise. Each answer starts with an **editorial prior** (seeded from Wikipedia pageviews — see `04-content-pipeline.md`) that is blended with live pick counts. The crowd takes over as the day goes on. Formula in `03-architecture.md`.

## Edge cases

| Case | Behavior |
|---|---|
| Timer hits 0 with text typed | Auto-swing with the current auto-correct (or raw text) |
| Timer hits 0 with empty input | Out of Bounds, 0 yds |
| Player closes the tab mid-round | Progress saved locally; resume at the same shot. The clock for an in-progress prompt does not pause (server records when the prompt was served). |
| Same answer twice in one round | Allowed if valid for both prompts |
| Ambiguous name (two players named the same) | Pool entities carry a disambiguator (team/era) shown in the auto-correct card |
| Answer list changes mid-day (data error) | Fix the list; already-locked shots keep their score |
| Player opens hole after midnight UTC rolls over | Mid-round players finish the hole they started |

## Streaks and stats (local, no account)

- Daily streak (played consecutive days)
- Best card, average yards, Ball Knower count
- Stored in localStorage; accounts can come later (see roadmap)

## Future ideas (not in v1)

- Friend groups / league leaderboards
- League-specific holes ("NFL Sunday")
- Hard mode: 20-second clock
- Weekly "major" — a longer 9-prompt round
