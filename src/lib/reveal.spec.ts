import { describe, expect, it } from 'vitest';
import { easeOut, flavor, flightMs, GATES, gateReached } from './reveal';

describe('gates', () => {
	it('run from Bench Warmer to Ball Knower', () => {
		expect(GATES.map((g) => g.id)).toEqual([
			'BENCH_WARMER',
			'ROLE_PLAYER',
			'STARTER',
			'ALL_STAR',
			'BALL_KNOWER'
		]);
	});

	it('upgrade the stamp as the carry passes each one', () => {
		expect(gateReached(0)).toBeNull();
		expect(gateReached(39)).toBeNull();
		expect(gateReached(40)).toBe('BENCH_WARMER');
		expect(gateReached(69.6)).toBe('STARTER');
		expect(gateReached(85)).toBe('ALL_STAR');
		expect(gateReached(100)).toBe('BALL_KNOWER');
	});

	it('land the full carry exactly on its own tier', () => {
		for (const g of GATES) expect(gateReached(g.yards * easeOut(1))).toBe(g.id);
	});
});

describe('flightMs', () => {
	it('hangs longer for longer carries', () => {
		expect(flightMs(100, 'BALL_KNOWER')).toBeGreaterThan(flightMs(40, 'BENCH_WARMER'));
	});
});

describe('flavor', () => {
	it('explains an out of bounds shot', () => {
		expect(flavor('OUT_OF_BOUNDS', { timedOut: true, blank: true })).toMatch(/clock ran out/);
		expect(flavor('OUT_OF_BOUNDS', { timedOut: false, blank: false })).toMatch(/Not on the list/);
	});
});
