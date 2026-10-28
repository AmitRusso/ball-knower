import { expect, it } from 'vitest';
import { allow } from './ratelimit';

it('allows up to the limit per minute, then resets', () => {
	const t = 1_000_000;
	expect([1, 2, 3].map(() => allow('test:a', 2, t))).toEqual([true, true, false]);
	expect(allow('test:b', 2, t)).toBe(true);
	expect(allow('test:a', 2, t + 60_000)).toBe(true);
});
