import { describe, expect, it } from 'vitest';
import { arcPath, obArc, OB_LINE_Y, PIN_X, pointOnArc, shotArc, TEE_X, yardsToX } from './geometry';

describe('yardsToX', () => {
	it('puts the tee and the pin where the mockups do', () => {
		expect(yardsToX(0)).toBe(TEE_X);
		expect(yardsToX(500)).toBe(PIN_X);
		expect(yardsToX(100)).toBe(74.8);
		expect(yardsToX(225)).toBe(153.3);
	});
});

describe('shotArc', () => {
	it('rises higher for longer shots', () => {
		expect(shotArc(0, 100).control.y).toBeLessThan(shotArc(0, 40).control.y);
	});

	it('serializes to an SVG path', () => {
		expect(arcPath(shotArc(140, 225))).toBe('M99.9 74 Q126.6 20 153.3 74');
	});
});

describe('obArc', () => {
	it('lands below the OB line', () => {
		expect(obArc(225).to.y).toBeGreaterThan(OB_LINE_Y);
	});
});

describe('pointOnArc', () => {
	it('starts and ends on the arc endpoints', () => {
		const arc = shotArc(0, 85);
		expect(pointOnArc(arc, 0)).toEqual(arc.from);
		expect(pointOnArc(arc, 1)).toEqual(arc.to);
	});
});
