// Load pipeline/out/content.json (from `python -m bk export`) into D1: pools,
// entities, aliases, templates and the scheduled holes with their answers.
//
//   pnpm db:load                local D1
//   pnpm db:load --remote       the deployed D1
//   pnpm db:load --force        also rewrite holes dated today or earlier
//
// Unlike db:seed this never touches plays or pick counts. Aliases are
// normalized here with the app's own normalize(), so they match exactly what
// the browser and the swing endpoint compute. A pool's version is bumped only
// when its content differs from D1's copy (pools.content_hash).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalize } from '../src/lib/match.ts';
import { q, query, row, wrangler } from './d1.ts';

interface Content {
	pools: {
		id: string;
		name: string;
		entities: {
			id: string;
			name: string;
			hint: string | null;
			aliases: string[];
			popularity: number;
			wikidataId: string;
		}[];
	}[];
	templates: { id: string; league: string; poolId: string; text: string; definition: string }[];
	holes: {
		holeNo: number;
		date: string;
		prompts: {
			position: number;
			text: string;
			note: string | null;
			league: string;
			poolId: string;
			templateId: string;
			answers: { entityId: string; priorShare: number }[];
		}[];
	}[];
}

const RETIRED_POOL = '_retired';
const ROWS_PER_INSERT = 200;

const args = process.argv.slice(2);
const target = args.includes('--remote') ? '--remote' : '--local';
const force = args.includes('--force');
const file =
	args.find((a) => a.startsWith('--file='))?.slice('--file='.length) ?? 'pipeline/out/content.json';
const today = new Date().toISOString().slice(0, 10);

const content = JSON.parse(readFileSync(file, 'utf8')) as Content;

/**
 * Normalized aliases per entity: no blanks, no repeats of the entity's own
 * name, and none that another entity in the pool also claims (as a name or an
 * alias) — an ambiguous alias would pick one of them arbitrarily.
 */
function cleanAliases(entities: Content['pools'][number]['entities']): Map<string, string[]> {
	const owners = new Map<string, Set<string>>();
	const claim = (key: string, id: string) => {
		if (!owners.has(key)) owners.set(key, new Set());
		owners.get(key)!.add(id);
	};
	for (const e of entities) {
		claim(normalize(e.name), e.id);
		for (const a of e.aliases) claim(normalize(a), e.id);
	}
	const out = new Map<string, string[]>();
	for (const e of entities) {
		const own = normalize(e.name);
		const keep = new Set<string>();
		for (const a of e.aliases) {
			const key = normalize(a);
			if (key && key !== own && owners.get(key)!.size === 1) keep.add(key);
		}
		out.set(e.id, [...keep].sort());
	}
	return out;
}

function inserts(head: string, rows: string[], tail = ''): string[] {
	const out: string[] = [];
	for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
		out.push(`${head} VALUES ${rows.slice(i, i + ROWS_PER_INSERT).join(', ')}${tail};`);
	}
	return out;
}

const sql: string[] = [];
const existing = new Map(
	query<{ id: string; version: number; content_hash: string | null }>(
		target,
		'SELECT id, version, content_hash FROM pools'
	).map((p) => [p.id, p])
);

// ── Pools ────────────────────────────────────────────────────────────────────
const changedPools: string[] = [];
for (const pool of content.pools) {
	const aliases = cleanAliases(pool.entities);
	const hash = createHash('sha256')
		.update(
			JSON.stringify([
				pool.name,
				pool.entities.map((e) => [e.id, e.name, e.hint, aliases.get(e.id)])
			])
		)
		.digest('hex')
		.slice(0, 16);
	const prev = existing.get(pool.id);
	if (prev?.content_hash === hash) continue;
	const version = prev ? prev.version + 1 : 1;
	changedPools.push(`${pool.id} v${version} (${pool.entities.length} entities)`);

	sql.push(
		`INSERT INTO pools (id, name, version, content_hash) VALUES ${row(pool.id, pool.name, version, hash)}
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, content_hash = excluded.content_hash;`,
		// Entities that leave the pool stay in D1 (past shots and answers point at them).
		`INSERT OR IGNORE INTO pools (id, name, version) VALUES ${row(RETIRED_POOL, 'Retired entities', 1)};`,
		`UPDATE entities SET pool_id = '${RETIRED_POOL}' WHERE pool_id = ${q(pool.id)};`,
		`DELETE FROM entity_aliases WHERE entity_id IN (SELECT id FROM entities WHERE pool_id = '${RETIRED_POOL}');`,
		...inserts(
			'INSERT INTO entities (id, pool_id, name, hint, popularity, wikidata_id)',
			pool.entities.map((e) => row(e.id, pool.id, e.name, e.hint, e.popularity, e.wikidataId)),
			` ON CONFLICT(id) DO UPDATE SET pool_id = excluded.pool_id, name = excluded.name,
			  hint = excluded.hint, popularity = excluded.popularity, wikidata_id = excluded.wikidata_id`
		),
		...inserts(
			'INSERT OR IGNORE INTO entity_aliases (entity_id, alias_norm)',
			pool.entities.flatMap((e) => aliases.get(e.id)!.map((a) => row(e.id, a)))
		)
	);
}

// ── Templates ────────────────────────────────────────────────────────────────
sql.push(
	...inserts(
		'INSERT INTO templates (id, league, pool_id, text, definition)',
		content.templates.map((t) => row(t.id, t.league, t.poolId, t.text, t.definition)),
		` ON CONFLICT(id) DO UPDATE SET league = excluded.league, pool_id = excluded.pool_id,
		  text = excluded.text, definition = excluded.definition`
	)
);

// ── Holes ────────────────────────────────────────────────────────────────────
const holes = content.holes.filter((h) => force || h.date > today);
const skipped = content.holes.length - holes.length;
for (const h of holes) {
	for (const p of h.prompts) {
		const sum = p.answers.reduce((s, a) => s + a.priorShare, 0);
		if (Math.abs(sum - 1) > 0.001)
			throw new Error(`Hole ${h.holeNo}/${p.position}: priors sum to ${sum}`);
	}
	// Replaces whatever was scheduled on that number or date. A hole with plays
	// can't be deleted (foreign keys), so this fails rather than lose them.
	const same = `SELECT hole_no FROM holes WHERE hole_no = ${h.holeNo} OR date_utc = ${q(h.date)}`;
	sql.push(
		`DELETE FROM prompt_answers WHERE prompt_id IN (SELECT id FROM prompts WHERE hole_no IN (${same}));`,
		`DELETE FROM prompts WHERE hole_no IN (${same});`,
		`DELETE FROM holes WHERE hole_no IN (${same});`,
		`INSERT INTO holes (hole_no, date_utc, status) VALUES ${row(h.holeNo, h.date, 'scheduled')};`
	);
	for (const p of h.prompts) {
		const id = h.holeNo * 10 + p.position;
		sql.push(
			`INSERT INTO prompts (id, hole_no, position, text, note, league, pool_id, template_id) VALUES ${row(id, h.holeNo, p.position, p.text, p.note, p.league, p.poolId, p.templateId)};`,
			...inserts(
				'INSERT INTO prompt_answers (prompt_id, entity_id, prior_share)',
				p.answers.map((a) => row(id, a.entityId, a.priorShare))
			)
		);
	}
}

// The hole being played today, or a scheduled one, on a pool whose entities are
// being replaced would lose its answers from the pool. Stop unless that's
// intended. "Today's" hole is the latest one dated on or before today: with no
// hole scheduled for today, yesterday's repeats (D15).
const loadedDates = new Set(holes.map((h) => h.date));
const changedIds = new Set(changedPools.map((p) => p.split(' ')[0]));
const atRisk = query<{ pool_id: string; date_utc: string }>(
	target,
	`SELECT DISTINCT p.pool_id, h.date_utc FROM prompts p JOIN holes h ON h.hole_no = p.hole_no
	 WHERE h.date_utc >= COALESCE(
	   (SELECT MAX(date_utc) FROM holes WHERE date_utc <= '${today}' AND status != 'draft'), '${today}')`
).filter((r) => changedIds.has(r.pool_id) && !loadedDates.has(r.date_utc));
if (atRisk.length && !force) {
	const list = atRisk.map((r) => `${r.pool_id} (hole on ${r.date_utc})`).join(', ');
	throw new Error(
		`Changed pools are used by live or scheduled holes this load doesn't replace: ${list}. Re-run with --force to load anyway.`
	);
}

mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/load-content.sql', sql.join('\n') + '\n');
wrangler('d1', 'execute', 'ball-knower', target, '--file=.wrangler/load-content.sql');

console.log(
	`Loaded ${holes.length} holes (${target.slice(2)})` +
		(skipped ? `, skipped ${skipped} dated today or earlier (--force to include)` : '') +
		`; pools updated: ${changedPools.join(', ') || 'none'}.`
);
