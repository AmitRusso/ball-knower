-- 0002 — pools remember a hash of their entities and aliases (M3), so
-- scripts/load-content.ts bumps a pool's version only when its content changes.

ALTER TABLE pools ADD COLUMN content_hash TEXT;
