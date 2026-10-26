// Shot reveal timeline (docs/02-design-system.md, "Motion"): the ball carries
// past each tier gate, the tier stamp upgrades as it passes, then slams down.

import { OUT_OF_BOUNDS, TIERS } from './scoring';
import type { ShotTierId, TierId } from './types';

/** Tier gates from the shortest carry (Bench Warmer) to the longest (Ball Knower). */
export const GATES = [...TIERS].sort((a, b) => a.yards - b.yards);
export const CARRY_MAX = GATES[GATES.length - 1].yards;

/** Seconds of tee-up before each prompt's clock starts. */
export const TEE_UP_SECONDS = 3;

/** Pause between landing and the stamp, and between the stamp and the flavor line. */
export const STAMP_DELAY_MS = 150;
export const SETTLE_DELAY_MS = 450;

/** Longer carries hang in the air longer, so passing each gate reads. */
export function flightMs(yards: number, tier: ShotTierId): number {
	return tier === OUT_OF_BOUNDS.id ? 1200 : 900 + yards * 12;
}

export function easeOut(t: number): number {
	return 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
}

/** The highest tier gate a carry has reached, or null before the first one. */
export function gateReached(carry: number): TierId | null {
	let reached: TierId | null = null;
	for (const g of GATES) if (carry >= g.yards - 0.5) reached = g.id;
	return reached;
}

const FLAVOR: Record<TierId, string> = {
	BALL_KNOWER: 'Almost nobody went there. A real ball knower.',
	ALL_STAR: 'A deep cut. Pure contact.',
	STARTER: 'Solid strike. Not everyone had that one.',
	ROLE_PLAYER: 'Safely in the fairway. A fair few had it.',
	BENCH_WARMER: 'The one everybody knows. Still counts.'
};

export function flavor(tier: ShotTierId, how: { timedOut: boolean; blank: boolean }): string {
	if (tier !== OUT_OF_BOUNDS.id) return FLAVOR[tier];
	if (how.timedOut && how.blank) return 'The clock ran out. The ball stays put.';
	if (how.blank) return 'No answer, no swing. The ball stays put.';
	return 'Not on the list. The ball stays put.';
}
