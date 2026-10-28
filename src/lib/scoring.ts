import type { ShotTierId, TierId } from './types';

// The only place tier thresholds and yardages live (see CLAUDE.md conventions).
export const TIERS = [
	{ id: 'BALL_KNOWER', label: 'Ball Knower', maxShare: 0.01, yards: 100 },
	{ id: 'ALL_STAR', label: 'All-Star', maxShare: 0.04, yards: 85 },
	{ id: 'STARTER', label: 'Starter', maxShare: 0.1, yards: 70 },
	{ id: 'ROLE_PLAYER', label: 'Role Player', maxShare: 0.25, yards: 55 },
	{ id: 'BENCH_WARMER', label: 'Bench Warmer', maxShare: 1.0, yards: 40 }
] as const satisfies readonly { id: TierId; label: string; maxShare: number; yards: number }[];

export const OUT_OF_BOUNDS = { id: 'OUT_OF_BOUNDS', label: 'Out of Bounds', yards: 0 } as const;

export const HOLE_LENGTH_YDS = 500;
export const SECONDS_PER_PROMPT = 45;

/** Prior strength in pseudo-picks (docs/03-architecture.md, "Rarity scoring"). */
export const PRIOR_K = 200;

/** share(a) = (count(a) + K · prior(a)) / (N + K) */
export function blendedShare(count: number, total: number, prior: number, k = PRIOR_K): number {
	return (count + k * prior) / (total + k);
}

export function tierForShare(share: number) {
	return TIERS.find((t) => share < t.maxShare) ?? TIERS[TIERS.length - 1];
}

export function tierInfo(id: ShotTierId) {
	return id === OUT_OF_BOUNDS.id ? OUT_OF_BOUNDS : TIERS.find((t) => t.id === id)!;
}

/** Short CSS-friendly key used for tier color classes, e.g. `tier-allstar`. */
export const TIER_CLASS: Record<ShotTierId, string> = {
	BALL_KNOWER: 'knower',
	ALL_STAR: 'allstar',
	STARTER: 'starter',
	ROLE_PLAYER: 'role',
	BENCH_WARMER: 'bench',
	OUT_OF_BOUNDS: 'ob'
};
