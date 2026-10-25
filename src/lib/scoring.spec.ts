import { describe, expect, it } from 'vitest';
import { blendedShare, tierForShare, tierInfo, TIERS } from './scoring';

describe('tierForShare', () => {
	it.each([
		[0, 'BALL_KNOWER'],
		[0.0099, 'BALL_KNOWER'],
		[0.01, 'ALL_STAR'],
		[0.0399, 'ALL_STAR'],
		[0.04, 'STARTER'],
		[0.0999, 'STARTER'],
		[0.1, 'ROLE_PLAYER'],
		[0.2499, 'ROLE_PLAYER'],
		[0.25, 'BENCH_WARMER'],
		[1, 'BENCH_WARMER']
	])('share %f → %s', (share, id) => {
		expect(tierForShare(share).id).toBe(id);
	});

	it('yards rise as tiers get rarer', () => {
		const yards = TIERS.map((t) => t.yards);
		expect(yards).toEqual([...yards].sort((a, b) => b - a));
	});
});

describe('blendedShare', () => {
	it('is the prior when nobody has played', () => {
		expect(blendedShare(0, 0, 0.12)).toBeCloseTo(0.12);
	});

	it('moves toward the crowd as picks come in', () => {
		const early = blendedShare(0, 0, 0.3);
		const late = blendedShare(10, 10_000, 0.3);
		expect(early).toBeCloseTo(0.3);
		expect(late).toBeLessThan(0.01);
	});
});

describe('tierInfo', () => {
	it('knows Out of Bounds', () => {
		expect(tierInfo('OUT_OF_BOUNDS').yards).toBe(0);
		expect(tierInfo('ALL_STAR').label).toBe('All-Star');
	});
});
