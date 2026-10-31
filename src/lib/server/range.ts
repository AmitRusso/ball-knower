// Driving Range: unlimited swings at prompts from past holes. Nothing here
// counts — no plays, no pick counts, no clock — and only prompts from holes
// that are already past are served or scored, so the range can never leak
// today's answers (hard rule 1).

import { error } from '@sveltejs/kit';
import { createMatcher } from '../match';
import { utcDate } from '../play';
import type { RangePrompt, RangeSwingRequest, RangeSwingResult } from '../types';
import { currentHole, loadPool } from './content';
import { pickCounts } from './counters';
import type { Bindings } from './env';
import { scoreShot } from './rules';

/** Recently seen prompt ids the client may ask to skip. */
export const MAX_SEEN = 50;

/** SQL condition for "this prompt's hole is past": dated before today and no longer the current hole. */
const PAST = `h.date_utc < ?1 AND h.status != 'draft' AND h.hole_no != ?2`;

async function pastParams(env: Bindings, now: number): Promise<[string, number]> {
	return [utcDate(now), (await currentHole(env, now))?.holeNo ?? -1];
}

/** A random prompt from a past hole, avoiding `seen` while there are others left. */
export async function rangePrompt(
	env: Bindings,
	seen: number[],
	now = Date.now()
): Promise<RangePrompt> {
	const { db } = env;
	const [today, current] = await pastParams(env, now);
	const skip = seen.slice(0, MAX_SEEN);
	const pick = (exclude: number[]) =>
		db
			.prepare(
				`SELECT p.id, p.hole_no, p.text, p.note, p.league, p.pool_id, pl.version
				 FROM prompts p
				 JOIN holes h ON h.hole_no = p.hole_no
				 JOIN pools pl ON pl.id = p.pool_id
				 WHERE ${PAST}
				   AND p.id NOT IN (SELECT value FROM json_each(?3))
				 ORDER BY random() LIMIT 1`
			)
			.bind(today, current, JSON.stringify(exclude))
			.first<{
				id: number;
				hole_no: number;
				text: string;
				note: string | null;
				league: string;
				pool_id: string;
				version: number;
			}>();
	// Every past prompt seen: start the bucket over.
	const row = (await pick(skip)) ?? (skip.length ? await pick([]) : null);
	if (!row) error(404, 'The Driving Range opens after the first hole');
	return {
		promptId: row.id,
		holeNo: row.hole_no,
		text: row.text,
		note: row.note ?? '',
		league: row.league,
		poolId: row.pool_id,
		poolVersion: row.version
	};
}

/**
 * Score a range swing against the hole's pick counts, without counting it, and
 * return the prompt's answers (they are public once the hole is past).
 */
export async function rangeSwing(
	env: Bindings,
	req: RangeSwingRequest,
	now = Date.now()
): Promise<RangeSwingResult> {
	const { db } = env;
	const [today, current] = await pastParams(env, now);
	const prompt = await db
		.prepare(
			`SELECT p.id, p.pool_id FROM prompts p JOIN holes h ON h.hole_no = p.hole_no
			 WHERE p.id = ?3 AND ${PAST}`
		)
		.bind(today, current, req.promptId)
		.first<{ id: number; pool_id: string }>();
	if (!prompt) error(404, `No past prompt ${req.promptId}`);

	const rawText = req.rawText.trim().slice(0, 200);
	let entity: { id: string; name: string } | null = null;
	if (req.entityId) {
		entity = await db
			.prepare(`SELECT id, name FROM entities WHERE id = ?1 AND pool_id = ?2`)
			.bind(req.entityId, prompt.pool_id)
			.first<{ id: string; name: string }>();
	} else if (rawText) {
		const pool = await loadPool(env, prompt.pool_id);
		entity = pool ? createMatcher(pool.entities).match(rawText) : null;
	}

	const [answer, list] = await db.batch([
		db
			.prepare(`SELECT prior_share FROM prompt_answers WHERE prompt_id = ?1 AND entity_id = ?2`)
			.bind(prompt.id, entity?.id ?? ''),
		db
			.prepare(
				`SELECT e.id, e.name FROM prompt_answers a JOIN entities e ON e.id = a.entity_id
				 WHERE a.prompt_id = ?1 ORDER BY e.name`
			)
			.bind(prompt.id)
	]);
	const prior = (answer.results[0] as { prior_share: number } | undefined)?.prior_share ?? null;
	const counts =
		prior !== null && entity ? await pickCounts(db, prompt.id, entity.id) : { count: 0, total: 0 };
	const scored = scoreShot(prior, counts);
	return {
		correct: scored.correct,
		canonicalName: entity?.name ?? rawText,
		entityId: entity?.id ?? null,
		tier: scored.tier,
		yards: scored.yards,
		answers: (list.results as { id: string; name: string }[]).map((r) => ({
			entityId: r.id,
			name: r.name
		}))
	};
}
