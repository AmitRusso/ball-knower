import { describe, expect, it } from 'vitest';
import {
	currentStreak,
	EMPTY_STATS,
	recordCompletion,
	secondsLeft,
	shotStarts,
	totalYards,
	type Shot
} from './play';
import type { ShotTierId } from './types';

const shot = (tier: ShotTierId, yards: number): Shot => ({
	index: 0,
	rawText: '',
	entityId: null,
	answer: '',
	tier,
	yards,
	timedOut: false
});

const card = [
	shot('BALL_KNOWER', 100),
	shot('BENCH_WARMER', 40),
	shot('OUT_OF_BOUNDS', 0),
	shot('ALL_STAR', 85)
];

describe('yardage', () => {
	it('adds up the card', () => {
		expect(totalYards(card)).toBe(225);
	});

	it('leaves the ball in place after an OB shot', () => {
		expect(shotStarts(card)).toEqual([0, 100, 140, 140]);
	});
});

describe('secondsLeft', () => {
	it('counts down from the time the prompt was served', () => {
		expect(secondsLeft(1_000, 1_000, 45)).toBe(45);
		expect(secondsLeft(1_000, 15_500, 45)).toBe(31);
		expect(secondsLeft(1_000, 99_000, 45)).toBe(0);
	});
});

describe('streaks', () => {
	it('starts, extends, and resets', () => {
		const day1 = recordCompletion(EMPTY_STATS, '2026-10-25', card);
		expect(day1).toMatchObject({ streak: 1, played: 1, bestCard: 225, ballKnowers: 1 });

		const day2 = recordCompletion(day1, '2026-10-26', card);
		expect(day2.streak).toBe(2);

		const gap = recordCompletion(day2, '2026-10-28', card);
		expect(gap.streak).toBe(1);
	});

	it('counts a hole only once per day', () => {
		const once = recordCompletion(EMPTY_STATS, '2026-10-25', card);
		expect(recordCompletion(once, '2026-10-25', card)).toBe(once);
	});

	it('crosses month boundaries', () => {
		const day1 = recordCompletion(EMPTY_STATS, '2026-10-31', card);
		expect(recordCompletion(day1, '2026-11-01', card).streak).toBe(2);
	});

	it('shows a lapsed streak as zero', () => {
		const stats = recordCompletion(EMPTY_STATS, '2026-10-25', card);
		expect(currentStreak(stats, '2026-10-26')).toBe(1);
		expect(currentStreak(stats, '2026-10-27')).toBe(0);
	});
});
