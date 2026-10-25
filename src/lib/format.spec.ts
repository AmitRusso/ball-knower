import { describe, expect, it } from 'vitest';
import { holeDate, untilNextHole } from './format';

describe('holeDate', () => {
	it('formats the hole date in UTC', () => {
		expect(holeDate('2026-10-25')).toBe('SUN · OCT 25');
		expect(holeDate('2026-10-25', false)).toBe('OCT 25');
	});
});

describe('untilNextHole', () => {
	it('counts down to midnight UTC', () => {
		expect(untilNextHole(Date.parse('2026-10-25T13:17:53Z'))).toBe('10:42:07');
		expect(untilNextHole(Date.parse('2026-10-25T00:00:00Z'))).toBe('24:00:00');
	});
});
