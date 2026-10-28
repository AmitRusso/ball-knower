import { tierInfo } from './scoring';
import type { ShotTierId } from './types';

// Closest emoji squares to the tier colors (Role Player's pale green has no
// square of its own, so it borrows brown to stay distinct from Starter).
const SQUARE: Record<ShotTierId, string> = {
	BALL_KNOWER: '🟨',
	ALL_STAR: '🟦',
	STARTER: '🟩',
	ROLE_PLAYER: '🟫',
	BENCH_WARMER: '⬜',
	OUT_OF_BOUNDS: '🟥'
};

export function shareHeadline(holeNo: number, total: number): string {
	return `BALL KNOWER #${holeNo} · ${total} YDS`;
}

export function shareText(holeNo: number, total: number, tiers: ShotTierId[], url: string): string {
	return [shareHeadline(holeNo, total), tiers.map((t) => SQUARE[t]).join(''), url].join('\n');
}

export function tiersLabel(tiers: ShotTierId[]): string {
	return `Shot tiers: ${tiers.map((t) => tierInfo(t).label).join(', ')}`;
}
