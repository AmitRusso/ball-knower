// Today's hole and entity pools: read from D1, cached in KV. Nothing here
// selects from prompt_answers — these payloads go to every browser (hard rule 1).

import { utcDate } from '../play';
import { HOLE_LENGTH_YDS, SECONDS_PER_PROMPT } from '../scoring';
import type { Entity, Hole, Pool } from '../types';
import type { Bindings } from './env';

const DAY_S = 86_400;

/**
 * The hole being played on `now`'s UTC date: the latest non-draft hole dated
 * on or before it, so a missing schedule repeats the last hole rather than
 * showing nothing. Cached in KV under the date, which makes the first request
 * after 00:00 UTC the one that publishes the new hole (Pages has no Cron
 * Triggers, D15).
 */
export async function currentHole({ db, kv }: Bindings, now = Date.now()): Promise<Hole | null> {
	const date = utcDate(now);
	const key = `hole:${date}`;
	const cached = await kv.get<Hole>(key, 'json');
	if (cached) return cached;

	const row = await db
		.prepare(
			`SELECT hole_no, date_utc FROM holes
			 WHERE date_utc <= ?1 AND status != 'draft'
			 ORDER BY date_utc DESC LIMIT 1`
		)
		.bind(date)
		.first<{ hole_no: number; date_utc: string }>();
	if (!row) return null;

	const [, , prompts] = await db.batch<{
		position: number;
		text: string;
		note: string | null;
		league: string;
		pool_id: string;
		version: number;
	}>([
		db
			.prepare(`UPDATE holes SET status = 'past' WHERE status = 'live' AND hole_no != ?1`)
			.bind(row.hole_no),
		db.prepare(`UPDATE holes SET status = 'live' WHERE hole_no = ?1`).bind(row.hole_no),
		db
			.prepare(
				`SELECT p.position, p.text, p.note, p.league, p.pool_id, pl.version
				 FROM prompts p JOIN pools pl ON pl.id = p.pool_id
				 WHERE p.hole_no = ?1 ORDER BY p.position`
			)
			.bind(row.hole_no)
	]);

	const hole: Hole = {
		holeNo: row.hole_no,
		date: row.date_utc,
		lengthYds: HOLE_LENGTH_YDS,
		secondsPerPrompt: SECONDS_PER_PROMPT,
		prompts: prompts.results.map((p) => ({
			index: p.position,
			text: p.text,
			note: p.note ?? '',
			league: p.league,
			poolId: p.pool_id,
			poolVersion: p.version
		}))
	};
	// A stand-in (yesterday's hole repeated) is re-checked every minute in case today's gets scheduled.
	await kv.put(key, JSON.stringify(hole), { expirationTtl: row.date_utc === date ? DAY_S : 60 });
	return hole;
}

/** Every entity in a pool, correct or not, ordered by name (never by correctness). */
export async function loadPool(
	{ db, kv }: Bindings,
	poolId: string,
	version?: number
): Promise<Pool | null> {
	if (version !== undefined) {
		const hit = await kv.get<Pool>(`pool:${poolId}:${version}`, 'json');
		if (hit) return hit;
	}
	const meta = await db
		.prepare(`SELECT version FROM pools WHERE id = ?1`)
		.bind(poolId)
		.first<{ version: number }>();
	if (!meta) return null;
	const key = `pool:${poolId}:${meta.version}`;
	if (meta.version !== version) {
		const hit = await kv.get<Pool>(key, 'json');
		if (hit) return hit;
	}

	const [entities, aliases] = await db.batch([
		db
			.prepare(`SELECT id, name, hint FROM entities WHERE pool_id = ?1 ORDER BY name, id`)
			.bind(poolId),
		db
			.prepare(
				`SELECT a.entity_id, a.alias_norm FROM entity_aliases a
				 JOIN entities e ON e.id = a.entity_id
				 WHERE e.pool_id = ?1 ORDER BY a.alias_norm`
			)
			.bind(poolId)
	]);

	const byId = new Map<string, Entity>();
	for (const e of entities.results as { id: string; name: string; hint: string | null }[]) {
		byId.set(e.id, e.hint ? { id: e.id, name: e.name, hint: e.hint } : { id: e.id, name: e.name });
	}
	for (const a of aliases.results as { entity_id: string; alias_norm: string }[]) {
		const e = byId.get(a.entity_id);
		if (e) (e.aliases ??= []).push(a.alias_norm);
	}

	const pool: Pool = { poolId, version: meta.version, entities: [...byId.values()] };
	// Immutable per version: a pool change bumps `pools.version`, which changes the key.
	await kv.put(key, JSON.stringify(pool));
	return pool;
}
