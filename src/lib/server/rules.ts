// Pure server-side rules for a swing: the shot clock and the rarity tier.

import { blendedShare, OUT_OF_BOUNDS, SECONDS_PER_PROMPT, tierForShare } from '../scoring';
import type { ShotTierId } from '../types';

/** Latency allowance on top of the 45-second clock (docs/03-architecture.md). */
export const CLOCK_GRACE_MS = 5_000;

/** A swing this long after the prompt was served is Out of Bounds. */
export function isLate(servedAtMs: number, nowMs: number): boolean {
	return nowMs - servedAtMs > SECONDS_PER_PROMPT * 1000 + CLOCK_GRACE_MS;
}

export interface Counts {
	/** Correct picks of this answer so far today. */
	count: number;
	/** Correct picks of any answer to this prompt so far today. */
	total: number;
}

/** Tier and yards for a shot, locked onto the shot row at swing time (hard rule 3). */
export function scoreShot(
	prior: number | null,
	counts: Counts
): { correct: boolean; tier: ShotTierId; yards: number } {
	if (prior === null) return { correct: false, tier: OUT_OF_BOUNDS.id, yards: OUT_OF_BOUNDS.yards };
	const tier = tierForShare(blendedShare(counts.count, counts.total, prior));
	return { correct: true, tier: tier.id, yards: tier.yards };
}
