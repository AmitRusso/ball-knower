import { describe, expect, it } from 'vitest';
import { cardCode, parseCardCode, shareText, tiersLabel } from './share';

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

describe('card codes', () => {
	it('round-trips every tier', () => {
		const tiers = [
			'BALL_KNOWER',
			'ALL_STAR',
			'STARTER',
			'ROLE_PLAYER',
			'BENCH_WARMER',
			'OUT_OF_BOUNDS'
		] as const;
		expect(cardCode([...tiers])).toBe('KASRBO');
		expect(parseCardCode('kasrbo')).toEqual(tiers);
	});

	it('rejects anything else', () => {
		expect(parseCardCode('')).toBeNull();
		expect(parseCardCode('KXK')).toBeNull();
		expect(parseCardCode('KKKKKKKKKK')).toBeNull();
	});
});
