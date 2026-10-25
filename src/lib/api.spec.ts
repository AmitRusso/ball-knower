import { describe, expect, it } from 'vitest';
import { getAnswers, getHole, swing } from './api';

describe('offline api', () => {
	it('sends prompts without answers', async () => {
		const hole = await getHole();
		expect(hole.prompts).toHaveLength(5);
		expect(JSON.stringify(hole)).not.toMatch(/answers|priorShare|entityId/);
	});

	it('scores a deep cut as a Ball Knower', async () => {
		const result = await swing({
			holeNo: 214,
			index: 0,
			entityId: 'nfl-mark-moseley',
			rawText: 'mosely'
		});
		expect(result).toEqual({
			correct: true,
			canonicalName: 'Mark Moseley',
			tier: 'BALL_KNOWER',
			yards: 100
		});
	});

	it('gives an obvious correct answer yards, never zero', async () => {
		const result = await swing({
			holeNo: 214,
			index: 0,
			entityId: 'nfl-barry-sanders',
			rawText: ''
		});
		expect(result.correct).toBe(true);
		expect(result.yards).toBeGreaterThan(0);
	});

	it('puts a wrong pool entity out of bounds with its canonical name', async () => {
		const result = await swing({
			holeNo: 214,
			index: 3,
			entityId: 'ctry-argentina',
			rawText: 'arg'
		});
		expect(result).toMatchObject({ correct: false, canonicalName: 'Argentina', yards: 0 });
	});

	it('puts unmatched raw text out of bounds', async () => {
		const result = await swing({ holeNo: 214, index: 1, entityId: null, rawText: ' zzz ' });
		expect(result).toMatchObject({ correct: false, canonicalName: 'zzz', tier: 'OUT_OF_BOUNDS' });
	});

	it('lists answers alphabetically', async () => {
		const answers = await getAnswers(214);
		const names = answers[2].answers.map((a) => a.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});
});
