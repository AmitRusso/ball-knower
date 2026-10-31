// Load data/sample-hole.json into D1 as today's hole (and again as yesterday's,
// for the Driving Range), wiping every play and pick count, then clear the
// HOLES KV cache.
//
//   pnpm db:seed                     local D1, hole dated today (UTC)
//   pnpm db:seed --date=2026-10-25   local D1, a fixed date
//   pnpm db:seed --remote            the deployed D1 — wipes production plays
//
// Runs on Node's built-in type stripping (Node 22.18+).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalize } from '../src/lib/match.ts';
import { row, wrangler } from './d1.ts';

interface SampleHole {
	holeNo: number;
	prompts: {
		position: number;
		league: string;
		poolId: string;
		text: string;
		note: string;
		answers: { entityId: string; priorShare: number }[];
	}[];
	pools: Record<
		string,
		{ name: string; entities: { id: string; name: string; hint?: string; aliases?: string[] }[] }
	>;
}

const args = process.argv.slice(2);
const target = args.includes('--remote') ? '--remote' : '--local';
const date =
	args.find((a) => a.startsWith('--date='))?.slice('--date='.length) ??
	new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad --date: ${date}`);

const hole = JSON.parse(readFileSync('data/sample-hole.json', 'utf8')) as SampleHole;

const sql: string[] = [
	// Children first: D1 enforces foreign keys.
	'DELETE FROM hole_totals;',
	'DELETE FROM shots;',
	'DELETE FROM plays;',
	'DELETE FROM pick_counts;',
	'DELETE FROM prompt_answers;',
	'DELETE FROM review_queue;',
	'DELETE FROM prompts;',
	'DELETE FROM templates;',
	'DELETE FROM holes;',
	'DELETE FROM entity_aliases;',
	'DELETE FROM entities;',
	'DELETE FROM pools;'
];

for (const [poolId, pool] of Object.entries(hole.pools)) {
	sql.push(`INSERT INTO pools (id, name, version) VALUES ${row(poolId, pool.name, 1)};`);
	for (const e of pool.entities) {
		sql.push(
			`INSERT INTO entities (id, pool_id, name, hint) VALUES ${row(e.id, poolId, e.name, e.hint)};`
		);
		const aliases = new Set((e.aliases ?? []).map(normalize).filter(Boolean));
		for (const alias of aliases) {
			sql.push(`INSERT INTO entity_aliases (entity_id, alias_norm) VALUES ${row(e.id, alias)};`);
		}
	}
}

// The same prompts again as yesterday's hole, so the Driving Range has past prompts to serve.
const yesterday = new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
for (const [holeNo, day, status] of [
	[hole.holeNo - 1, yesterday, 'past'],
	[hole.holeNo, date, 'live']
] as const) {
	sql.push(`INSERT INTO holes (hole_no, date_utc, status) VALUES ${row(holeNo, day, status)};`);
	for (const p of hole.prompts) {
		const id = holeNo * 10 + p.position;
		sql.push(
			`INSERT INTO prompts (id, hole_no, position, text, note, league, pool_id) VALUES ${row(id, holeNo, p.position, p.text, p.note, p.league, p.poolId)};`
		);
		for (const a of p.answers) {
			sql.push(
				`INSERT INTO prompt_answers (prompt_id, entity_id, prior_share) VALUES ${row(id, a.entityId, a.priorShare)};`
			);
		}
	}
}

mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/seed.sql', sql.join('\n') + '\n');

wrangler('d1', 'execute', 'ball-knower', target, '--file=.wrangler/seed.sql');

// Cached holes and pools would otherwise outlive the data they came from.
const keys = (
	JSON.parse(wrangler('kv', 'key', 'list', '--binding=HOLES', target)) as {
		name: string;
	}[]
).map((k) => k.name);
if (keys.length) {
	writeFileSync('.wrangler/seed-kv-keys.json', JSON.stringify(keys));
	wrangler(
		'kv',
		'bulk',
		'delete',
		'.wrangler/seed-kv-keys.json',
		'--binding=HOLES',
		target,
		'--force'
	);
}

console.log(
	`Seeded hole ${hole.holeNo} for ${date} (${target.slice(2)}); cleared ${keys.length} KV keys.`
);
