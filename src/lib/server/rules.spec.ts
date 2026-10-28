import { describe, expect, it } from 'vitest';
import { PRIOR_K, SECONDS_PER_PROMPT } from '../scoring';
import { CLOCK_GRACE_MS, isLate, scoreShot } from './rules';

describe('isLate', () => {
	const served = Date.parse('2026-10-28T12:00:00Z');
	const limit = SECONDS_PER_PROMPT * 1000 + CLOCK_GRACE_MS;

	it('allows the full clock plus the latency grace', () => {
		expect(isLate(served, served + limit)).toBe(false);
	});

	it('puts anything later out of bounds', () => {
		expect(isLate(served, served + limit + 1)).toBe(true);
	});
});

describe('scoreShot', () => {
	it('puts a wrong answer out of bounds', () => {
		expect(scoreShot(null, { count: 0, total: 0 })).toEqual({
			correct: false,
			tier: 'OUT_OF_BOUNDS',
			yards: 0
		});
	});

	it('scores from the prior alone before anyone has picked', () => {
		expect(scoreShot(0.0035, { count: 0, total: 0 })).toMatchObject({ tier: 'BALL_KNOWER' });
		expect(scoreShot(0.3, { count: 0, total: 0 })).toMatchObject({ tier: 'BENCH_WARMER' });
	});

	it('lets the crowd overrule the prior once picks pile up', () => {
		// A deep cut everyone suddenly picks stops being rare…
		expect(scoreShot(0.0035, { count: 500, total: 1000 })).toMatchObject({ tier: 'BENCH_WARMER' });
		// …and an obvious answer nobody picks becomes one.
		expect(scoreShot(0.3, { count: 0, total: 50 * PRIOR_K })).toMatchObject({
			tier: 'BALL_KNOWER',
			yards: 100
		});
	});

	it('moves a rare answer up a tier after a couple of picks (K = 200)', () => {
		// (2 + 200 · 0.0024) / (2 + 200) ≈ 1.2%: past the Ball Knower line.
		expect(scoreShot(0.0024, { count: 1, total: 1 })).toMatchObject({ tier: 'BALL_KNOWER' });
		expect(scoreShot(0.0024, { count: 2, total: 2 })).toMatchObject({ tier: 'ALL_STAR' });
	});
});
