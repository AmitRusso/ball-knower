-- Ball Knower — draft Cloudflare D1 (SQLite) schema.
-- See docs/03-architecture.md. Turn into numbered migrations in M2.

PRAGMA foreign_keys = ON;

-- ── Entity universe (what auto-correct matches against) ─────────────────────

CREATE TABLE pools (
  id           TEXT PRIMARY KEY,            -- 'nba-franchises', 'mlb-players'
  name         TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1   -- bump when entities/aliases change
);

CREATE TABLE entities (
  id           TEXT PRIMARY KEY,            -- 'nba-sas', 'mlb-welchmi01'
  pool_id      TEXT NOT NULL REFERENCES pools(id),
  name         TEXT NOT NULL,               -- canonical display name
  hint         TEXT,                        -- disambiguator shown in auto-correct ('NBA', 'P, 1880–92')
  popularity   REAL NOT NULL DEFAULT 0,     -- pageview-based, used only for tie-breaks
  wikidata_id  TEXT
);
CREATE INDEX idx_entities_pool ON entities(pool_id);

CREATE TABLE entity_aliases (
  entity_id    TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias_norm   TEXT NOT NULL,               -- normalized (lowercase, no accents/punctuation)
  PRIMARY KEY (entity_id, alias_norm)
);
CREATE INDEX idx_aliases_norm ON entity_aliases(alias_norm);

-- ── Daily content ───────────────────────────────────────────────────────────

CREATE TABLE holes (
  hole_no      INTEGER PRIMARY KEY,         -- 1, 2, 3 …
  date_utc     TEXT NOT NULL UNIQUE,        -- '2026-10-25'
  status       TEXT NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('draft','scheduled','live','past'))
);

CREATE TABLE prompts (
  id           INTEGER PRIMARY KEY,
  hole_no      INTEGER REFERENCES holes(hole_no),  -- NULL while in the approved pool
  position     INTEGER CHECK (position BETWEEN 0 AND 4),
  text         TEXT NOT NULL,
  note         TEXT,
  league       TEXT NOT NULL,               -- 'NFL', 'NBA', 'MLB', 'NHL', 'SOCCER', 'ANY'
  pool_id      TEXT NOT NULL REFERENCES pools(id),
  template_id  TEXT REFERENCES templates(id),
  UNIQUE (hole_no, position)
);

CREATE TABLE prompt_answers (
  prompt_id    INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  entity_id    TEXT NOT NULL REFERENCES entities(id),
  prior_share  REAL NOT NULL,               -- sums to 1 across a prompt's answers
  PRIMARY KEY (prompt_id, entity_id)
);

-- Live pick counts (correct answers only). One upsert per correct swing.
-- May move to a Durable Object per hole if write contention appears.
CREATE TABLE pick_counts (
  prompt_id    INTEGER NOT NULL REFERENCES prompts(id),
  entity_id    TEXT NOT NULL REFERENCES entities(id),
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (prompt_id, entity_id)
);

-- ── Plays ───────────────────────────────────────────────────────────────────

CREATE TABLE plays (
  id           INTEGER PRIMARY KEY,
  hole_no      INTEGER NOT NULL REFERENCES holes(hole_no),
  player_id    TEXT NOT NULL,               -- client UUID
  started_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at  TEXT,
  total_yards  INTEGER,
  UNIQUE (hole_no, player_id)
);

CREATE TABLE shots (
  play_id      INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL CHECK (position BETWEEN 0 AND 4),
  served_at    TEXT NOT NULL,               -- when the prompt was shown (server clock)
  swung_at     TEXT,
  raw_text     TEXT,
  entity_id    TEXT REFERENCES entities(id),
  correct      INTEGER CHECK (correct IN (0,1)),
  tier         TEXT CHECK (tier IN ('BENCH_WARMER','ROLE_PLAYER','STARTER','ALL_STAR','BALL_KNOWER','OUT_OF_BOUNDS')),
  yards        INTEGER,                     -- locked at swing time
  PRIMARY KEY (play_id, position)
);

-- Distribution of completed totals, for "longer than X% of players".
CREATE TABLE hole_totals (
  hole_no      INTEGER NOT NULL REFERENCES holes(hole_no),
  total_yards  INTEGER NOT NULL,
  players      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hole_no, total_yards)
);

-- ── Content pipeline staging ────────────────────────────────────────────────

CREATE TABLE templates (
  id           TEXT PRIMARY KEY,            -- 'nba-franchise-titles'
  league       TEXT NOT NULL,
  pool_id      TEXT NOT NULL REFERENCES pools(id),
  text         TEXT NOT NULL,               -- with {params}
  definition   TEXT                         -- YAML/JSON of params + source query
);

CREATE TABLE review_queue (
  id           INTEGER PRIMARY KEY,
  template_id  TEXT REFERENCES templates(id),
  text         TEXT NOT NULL,
  note         TEXT,
  payload      TEXT NOT NULL,               -- JSON: answers + priors + flags
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  volatile     INTEGER NOT NULL DEFAULT 0,  -- answer list may change soon
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
