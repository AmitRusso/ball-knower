import { expect, test, type APIRequestContext } from '@playwright/test';
import type { Hole, Pool, StartResult, SwingResult } from '../src/lib/types';

// API-level checks against local D1 (seeded fresh by the webServer command).
// Each player is a new random id; only the countries prompt (index 3) gets
// correct picks here, so the UI tests' tiers on other prompts are unaffected.

const COUNTRIES = 3;

function player(request: APIRequestContext) {
	const headers = { 'x-player-id': crypto.randomUUID() };
	return {
		start: (holeNo: number, index: number) =>
			request.post(`/api/prompt/${index}/start`, { headers, data: { holeNo } }),
		swing: (holeNo: number, index: number, entityId: string | null, rawText: string) =>
			request.post('/api/swing', { headers, data: { holeNo, index, entityId, rawText } }),
		answers: (holeNo: number) => request.get(`/api/hole/${holeNo}/answers`, { headers }),
		/** Tee up and swing a blank (Out of Bounds) for each shot before `upTo`. */
		async whiff(holeNo: number, upTo: number) {
			for (let i = 0; i < upTo; i++) {
				expect((await this.start(holeNo, i)).ok()).toBe(true);
				expect((await this.swing(holeNo, i, null, '')).ok()).toBe(true);
			}
		}
	};
}

async function today(request: APIRequestContext): Promise<Hole> {
	const res = await request.get('/api/hole/today');
	expect(res.ok()).toBe(true);
	return res.json();
}

test('today’s hole and its pools carry no answers', async ({ request }) => {
	const res = await request.get('/api/hole/today');
	const text = await res.text();
	expect(text).not.toMatch(/answers|prior|correct/i);
	const hole = JSON.parse(text) as Hole;
	expect(hole.prompts).toHaveLength(5);

	const p = hole.prompts[COUNTRIES];
	const poolRes = await request.get(`/api/pool/${p.poolId}?v=${p.poolVersion}`);
	expect(poolRes.headers()['cache-control']).toContain('immutable');
	const pool = (await poolRes.json()) as Pool;
	const names = pool.entities.map((e) => e.name);
	// Wrong answers are in the pool too, and the order is by name, never by correctness.
	expect(names).toContain('Argentina');
	expect(names).toContain('United States');
	expect(names).toEqual([...names].sort());
});

test('answers stay locked until the player finishes the hole', async ({ request }) => {
	const hole = await today(request);
	const a = player(request);
	expect((await request.get(`/api/hole/${hole.holeNo}/answers`)).status()).toBe(403);
	expect((await a.answers(hole.holeNo)).status()).toBe(403);

	await a.whiff(hole.holeNo, 4);
	expect((await a.answers(hole.holeNo)).status()).toBe(403);

	await a.start(hole.holeNo, 4);
	await a.swing(hole.holeNo, 4, null, '');
	const res = await a.answers(hole.holeNo);
	expect(res.status()).toBe(200);
	const answers = await res.json();
	expect(answers).toHaveLength(5);
	expect(answers[0].answers.map((x: { name: string }) => x.name)).toContain('Mark Moseley');
	// Somebody else's finished play doesn't open it for a new player.
	expect((await player(request).answers(hole.holeNo)).status()).toBe(403);
});

test('the server owns the clock and the order of shots', async ({ request }) => {
	const hole = await today(request);
	const a = player(request);
	expect((await a.swing(hole.holeNo, 0, null, 'barry sanders')).status()).toBe(409);
	expect((await a.start(hole.holeNo, 1)).status()).toBe(409);

	const first = (await (await a.start(hole.holeNo, 0)).json()) as StartResult;
	await new Promise((r) => setTimeout(r, 300));
	const again = (await (await a.start(hole.holeNo, 0)).json()) as StartResult;
	expect(again.elapsedMs).toBeGreaterThanOrEqual(first.elapsedMs + 250);

	expect((await a.start(hole.holeNo, 1)).status()).toBe(409);
	expect((await a.swing(hole.holeNo, 0, null, '')).ok()).toBe(true);
	expect((await a.start(hole.holeNo, 1)).ok()).toBe(true);
	expect((await a.start(hole.holeNo, 9)).status()).toBe(400);
});

test('swings are idempotent and scored only by the server', async ({ request }) => {
	const hole = await today(request);
	const a = player(request);
	await a.start(hole.holeNo, 0);
	const res = await a.swing(hole.holeNo, 0, 'ctry-argentina', 'argentina');
	// An entity from another prompt's pool is just Out of Bounds.
	const first = (await res.json()) as SwingResult;
	expect(first).toMatchObject({ correct: false, tier: 'OUT_OF_BOUNDS', yards: 0 });

	const replay = (await (
		await a.swing(hole.holeNo, 0, 'nfl-mark-moseley', 'mark moseley')
	).json()) as SwingResult;
	expect(replay).toEqual(first);
});

test('rarity tiers follow real picks', async ({ request }) => {
	const hole = await today(request);
	const results: SwingResult[] = [];
	for (let i = 0; i < 3; i++) {
		const p = player(request);
		await p.whiff(hole.holeNo, COUNTRIES);
		await p.start(hole.holeNo, COUNTRIES);
		// The third player types it raw: the server matches it against the pool.
		const res =
			i < 2
				? await p.swing(hole.holeNo, COUNTRIES, 'ctry-finland', 'finland')
				: await p.swing(hole.holeNo, COUNTRIES, null, 'finnland');
		results.push(await res.json());
	}
	// Prior 0.24%: two picks keep it under 1%, the third crosses into All-Star.
	expect(results.map((r) => r.tier)).toEqual(['BALL_KNOWER', 'BALL_KNOWER', 'ALL_STAR']);
	expect(results[2]).toMatchObject({ correct: true, canonicalName: 'Finland', yards: 85 });
});

test('client error reports are accepted and validated', async ({ request }) => {
	const ok = await request.post('/api/log', {
		data: { message: 'TypeError: x is undefined', stack: 'at play', path: '/play' }
	});
	expect(ok.status()).toBe(204);
	expect((await request.post('/api/log', { data: { stack: 'no message' } })).status()).toBe(400);
});
