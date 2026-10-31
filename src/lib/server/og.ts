// The share-card image (1200×630, Open Graph): hole number, total yards, the
// five tier squares and the ball's spot on the fairway. Built from the card
// code alone, so it never touches the database and never shows an answer.

import { HOLE_LENGTH_YDS, tierInfo } from '../scoring';
import type { ShotTierId } from '../types';
import { Canvas, GLYPH_H, type Rgb } from './png';

// Hex values from design/tokens.css.
const GREEN_900: Rgb = [0x0e, 0x26, 0x18];
const GREEN_700: Rgb = [0x17, 0x3d, 0x2a];
const GREEN_650: Rgb = [0x1a, 0x45, 0x30];
const GREEN_500: Rgb = [0x2c, 0x66, 0x44];
const CREAM: Rgb = [0xf3, 0xee, 0xdf];
const GOLD: Rgb = [0xf2, 0xb6, 0x32];
const TIER_BG: Record<ShotTierId, Rgb> = {
	BENCH_WARMER: [0xd9, 0xd4, 0xc4],
	ROLE_PLAYER: [0xa9, 0xc4, 0xa0],
	STARTER: [0x2e, 0x6b, 0x45],
	ALL_STAR: [0x1e, 0x4e, 0x8c],
	BALL_KNOWER: GOLD,
	OUT_OF_BOUNDS: [0xa8, 0x32, 0x1f]
};

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export function cardTotal(tiers: ShotTierId[]): number {
	return tiers.reduce((sum, t) => sum + tierInfo(t).yards, 0);
}

export async function renderCard(holeNo: number, tiers: ShotTierId[]): Promise<Uint8Array> {
	const c = new Canvas(OG_WIDTH, OG_HEIGHT, GREEN_700);
	const total = cardTotal(tiers);
	const left = 80;

	// Fairway stripes, as on the site.
	for (let x = 0; x < OG_WIDTH; x += 112) c.rect(x, 0, 56, OG_HEIGHT, GREEN_650);

	c.text('BALL KNOWER', left, 64, 9, GOLD);
	c.text(`HOLE #${holeNo}`, left, 150, 6, CREAM);

	const big = 20;
	const small = 9;
	const w = c.text(String(total), left, 230, big, GOLD);
	// YDS sits on the same baseline as the total.
	c.text('YDS', left + w + 36, 230 + GLYPH_H * (big - small), small, CREAM);

	// Tier squares with a hard shadow, like the buttons.
	const size = 84;
	const gap = 20;
	tiers.forEach((t, i) => {
		const x = left + i * (size + gap);
		c.rect(x, 420 + 8, size, size, GREEN_900);
		c.rect(x, 420, size, size, TIER_BG[t]);
	});

	// The fairway: tee to pin, with the ball where the card left it.
	const x0 = left;
	const x1 = OG_WIDTH - left;
	const y = 556;
	c.rect(x0, y, x1 - x0, 28, GREEN_500);
	const ball = x0 + ((x1 - x0) * Math.min(total, HOLE_LENGTH_YDS)) / HOLE_LENGTH_YDS;
	c.rect(x1 - 4, y - 96, 8, 110, CREAM);
	c.pennant(x1 + 4, y - 96, 56, 40, GOLD);
	c.rect(x1 - 22, y + 10, 44, 10, GREEN_900);
	c.rect(Math.min(ball, x1 - 30) - 12, y + 2, 24, 24, CREAM);

	return c.png();
}
