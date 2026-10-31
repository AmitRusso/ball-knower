import { writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cardTotal, OG_HEIGHT, OG_WIDTH, renderCard } from './og';
import { crc32 } from './png';

describe('renderCard', () => {
	it('writes a valid 1200×630 palette PNG', async () => {
		const png = await renderCard(214, [
			'BALL_KNOWER',
			'BENCH_WARMER',
			'ALL_STAR',
			'OUT_OF_BOUNDS',
			'BALL_KNOWER'
		]);
		if (process.env.BK_OG_OUT) writeFileSync(process.env.BK_OG_OUT, png);
		expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

		// Walk the chunks: every CRC checks out, and the image data inflates to the full raster.
		const view = new DataView(png.buffer, png.byteOffset);
		const types: string[] = [];
		let idat = new Uint8Array();
		for (let at = 8; at < png.length;) {
			const len = view.getUint32(at);
			const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
			expect(view.getUint32(at + 8 + len)).toBe(crc32(png.subarray(at + 4, at + 8 + len)));
			if (type === 'IHDR') {
				expect(view.getUint32(at + 8)).toBe(OG_WIDTH);
				expect(view.getUint32(at + 12)).toBe(OG_HEIGHT);
			}
			if (type === 'IDAT') idat = png.slice(at + 8, at + 8 + len);
			types.push(type);
			at += 12 + len;
		}
		expect(types).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
		expect(inflateSync(idat).length).toBe((OG_WIDTH + 1) * OG_HEIGHT);
	});

	it('totals the yards from the tiers', () => {
		expect(cardTotal(['BALL_KNOWER', 'BENCH_WARMER', 'ALL_STAR', 'OUT_OF_BOUNDS'])).toBe(225);
	});
});
