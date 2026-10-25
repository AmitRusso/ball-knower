import { describe, expect, it } from 'vitest';
import { shareText, tiersLabel } from './share';

describe('shareText', () => {
	it('matches the card block', () => {
		const text = shareText(
			214,
			325,
			['BALL_KNOWER', 'BENCH_WARMER', 'ALL_STAR', 'OUT_OF_BOUNDS', 'BALL_KNOWER'],
			'https://ball-knower.pages.dev'
		);
		expect(text).toBe('BALL KNOWER #214 · 325 YDS\n🟨⬜🟦🟥🟨\nhttps://ball-knower.pages.dev');
	});

	it('never includes answers', () => {
		const text = shareText(214, 100, ['BALL_KNOWER'], 'https://x.test');
		expect(text).not.toMatch(/moseley/i);
	});
});

describe('tiersLabel', () => {
	it('names every tier for screen readers', () => {
		expect(tiersLabel(['STARTER', 'OUT_OF_BOUNDS'])).toBe('Shot tiers: Starter, Out of Bounds');
	});
});
