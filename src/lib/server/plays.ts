// One play per player per hole: the server-side clock, swings, and the
// answers gate. The server computes every tier and yardage; nothing the client
// sends about scoring is trusted.

import { error } from '@sveltejs/kit';
import { createMatcher } from '../match';
import { utcDate } from '../play';
import type { PromptAnswers, StartResult, SwingRequest, SwingResult } from '../types';
import { loadPool, currentHole } from './content';
import { pickCounts, recordPick } from './counters';
import type { Bindings } from './env';
import { isLate, scoreShot } from './rules';

const iso = (ms: number) => new Date(ms).toISOString();

interface HoleRow {
	hole_no: number;
	date_utc: string;
	prompts: number;
}

async function holeRow(db: D1Database, holeNo: number): Promise<HoleRow> {
	const row = await db
		.prepare(
			`SELECT h.hole_no, h.date_utc, (SELECT COUNT(*) FROM prompts p WHERE p.hole_no = h.hole_no) AS prompts
			 FROM holes h WHERE h.hole_no = ?1 AND h.status != 'draft'`
		)
		.bind(holeNo)
		.first<HoleRow>();
	if (!row) error(404, `No hole ${holeNo}`);
	return row;
}

async function playId(db: D1Database, holeNo: number, player: string): Promise<number | null> {
	const row = await db
		.prepare(`SELECT id FROM plays WHERE hole_no = ?1 AND player_id = ?2`)
		.bind(holeNo, player)
		.first<{ id: number }>();
	return row?.id ?? null;
}

/**
 * Record when a prompt was first served. Calling it again for the same prompt
 * returns the original time, so a reload never restarts the clock. Prompts are
 * served in order, one at a time.
 */
export async function startPrompt(
	env: Bindings,
	player: string,
	holeNo: number,
	index: number,
	now = Date.now()
): Promise<StartResult> {
	const { db } = env;
	const hole = await holeRow(db, holeNo);
	if (!Number.isInteger(index) || index < 0 || index >= hole.prompts) {
		error(400, `No prompt ${index} on hole ${holeNo}`);
	}

	let play = await playId(db, holeNo, player);
	if (play === null) {
		// New plays only on the current hole; a play begun before 00:00 UTC may finish.
		if ((await currentHole(env, now))?.holeNo !== holeNo) error(409, `Hole ${holeNo} is closed`);
		await db
			.prepare(`INSERT OR IGNORE INTO plays (hole_no, player_id, started_at) VALUES (?1, ?2, ?3)`)
			.bind(holeNo, player, iso(now))
			.run();
		play = (await playId(db, holeNo, player))!;
	}

	// Insert only if every earlier shot has been swung and this one isn't served yet.
	await db
		.prepare(
			`INSERT OR IGNORE INTO shots (play_id, position, served_at)
			 SELECT ?1, ?2, ?3
			 WHERE (SELECT COUNT(*) FROM shots WHERE play_id = ?1 AND swung_at IS NOT NULL) = ?2`
		)
		.bind(play, index, iso(now))
		.run();
	const shot = await db
		.prepare(`SELECT served_at FROM shots WHERE play_id = ?1 AND position = ?2`)
		.bind(play, index)
		.first<{ served_at: string }>();
	if (!shot) error(409, `Swing shot ${index} before teeing up the next one`);
	return { elapsedMs: Math.max(0, now - Date.parse(shot.served_at)) };
}

interface ShotRow {
	served_at: string;
	swung_at: string | null;
	raw_text: string | null;
	name: string | null;
	correct: number | null;
	tier: SwingResult['tier'] | null;
	yards: number | null;
}

async function lockedResult(db: D1Database, play: number, index: number): Promise<SwingResult> {
	const [shot, total] = await db.batch([
		db
			.prepare(
				`SELECT s.raw_text, s.correct, s.tier, s.yards, e.name
				 FROM shots s LEFT JOIN entities e ON e.id = s.entity_id
				 WHERE s.play_id = ?1 AND s.position = ?2`
			)
			.bind(play, index),
		db.prepare(`SELECT COALESCE(SUM(yards), 0) AS total FROM shots WHERE play_id = ?1`).bind(play)
	]);
	const s = shot.results[0] as ShotRow;
	return {
		correct: s.correct === 1,
		canonicalName: s.name ?? s.raw_text ?? '',
		tier: s.tier!,
		yards: s.yards!,
		totalYards: (total.results[0] as { total: number }).total
	};
}

/** Score a swing and lock it. A second swing for the same shot returns the first result. */
export async function swing(
	env: Bindings,
	player: string,
	req: SwingRequest,
	now = Date.now()
): Promise<SwingResult> {
	const { db } = env;
	const play = await playId(db, req.holeNo, player);
	const shot =
		play === null
			? null
			: await db
					.prepare(`SELECT served_at, swung_at FROM shots WHERE play_id = ?1 AND position = ?2`)
					.bind(play, req.index)
					.first<Pick<ShotRow, 'served_at' | 'swung_at'>>();
	if (play === null || !shot) error(409, `Prompt ${req.index} was never served`);
	if (shot.swung_at) return lockedResult(db, play, req.index);

	const prompt = await db
		.prepare(
			`SELECT id, pool_id, (SELECT COUNT(*) FROM prompts q WHERE q.hole_no = ?1) AS prompts
			 FROM prompts WHERE hole_no = ?1 AND position = ?2`
		)
		.bind(req.holeNo, req.index)
		.first<{ id: number; pool_id: string; prompts: number }>();
	if (!prompt) error(404, `No prompt ${req.index} on hole ${req.holeNo}`);

	// The entity must come from this prompt's pool. With no id, match the raw
	// text on the server with the same normalizer the browser uses.
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

	const late = isLate(Date.parse(shot.served_at), now);
	const answer =
		entity && !late
			? await db
					.prepare(`SELECT prior_share FROM prompt_answers WHERE prompt_id = ?1 AND entity_id = ?2`)
					.bind(prompt.id, entity.id)
					.first<{ prior_share: number }>()
			: null;
	const counts = answer ? await pickCounts(db, prompt.id, entity!.id) : { count: 0, total: 0 };
	const scored = scoreShot(answer?.prior_share ?? null, counts);

	const lock = db
		.prepare(
			`UPDATE shots SET swung_at = ?3, raw_text = ?4, entity_id = ?5, correct = ?6, tier = ?7, yards = ?8
			 WHERE play_id = ?1 AND position = ?2 AND swung_at IS NULL`
		)
		.bind(
			play,
			req.index,
			iso(now),
			rawText,
			entity?.id ?? null,
			scored.correct ? 1 : 0,
			scored.tier,
			scored.yards
		);
	const finish = [
		db
			.prepare(
				`UPDATE plays SET finished_at = ?2,
				   total_yards = (SELECT COALESCE(SUM(yards), 0) FROM shots WHERE play_id = ?1)
				 WHERE id = ?1 AND finished_at IS NULL
				   AND (SELECT COUNT(*) FROM shots WHERE play_id = ?1 AND swung_at IS NOT NULL) = ?3`
			)
			.bind(play, iso(now), prompt.prompts),
		db
			.prepare(
				`INSERT INTO hole_totals (hole_no, total_yards, players)
				 SELECT hole_no, total_yards, 1 FROM plays WHERE id = ?1 AND changes() = 1
				 ON CONFLICT (hole_no, total_yards) DO UPDATE SET players = players + 1`
			)
			.bind(play)
	];
	const results = await db.batch(
		scored.correct ? [lock, recordPick(db, prompt.id, entity!.id), ...finish] : [lock, ...finish]
	);
	// Lost a race with a concurrent swing for the same shot: its result stands.
	if (results[0].meta.changes !== 1) return lockedResult(db, play, req.index);

	const total = await db
		.prepare(`SELECT COALESCE(SUM(yards), 0) AS total FROM shots WHERE play_id = ?1`)
		.bind(play)
		.first<{ total: number }>();
	return {
		correct: scored.correct,
		canonicalName: entity?.name ?? rawText,
		tier: scored.tier,
		yards: scored.yards,
		totalYards: total?.total ?? 0
	};
}

/** Every correct answer per prompt, only once this player has finished the hole (hard rule 1). */
export async function answers(
	env: Bindings,
	player: string | null,
	holeNo: number,
	now = Date.now()
): Promise<PromptAnswers[]> {
	const { db } = env;
	const hole = await holeRow(db, holeNo);
	// Past means replaced: a stale hole repeated today (no schedule) is still live.
	const past =
		hole.date_utc < utcDate(now) && (await currentHole(env, now))?.holeNo !== hole.hole_no;
	if (!past) {
		const play = player
			? await db
					.prepare(
						`SELECT finished_at FROM plays WHERE hole_no = ?1 AND player_id = ?2 AND finished_at IS NOT NULL`
					)
					.bind(holeNo, player)
					.first()
			: null;
		if (!play) error(403, 'Finish the hole to see the answers');
	}

	const rows = await db
		.prepare(
			`SELECT p.position, e.id, e.name
			 FROM prompts p
			 JOIN prompt_answers a ON a.prompt_id = p.id
			 JOIN entities e ON e.id = a.entity_id
			 WHERE p.hole_no = ?1`
		)
		.bind(holeNo)
		.all<{ position: number; id: string; name: string }>();
	const out: PromptAnswers[] = Array.from({ length: hole.prompts }, (_, index) => ({
		index,
		answers: []
	}));
	for (const r of rows.results) out[r.position]?.answers.push({ entityId: r.id, name: r.name });
	for (const p of out) p.answers.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}
