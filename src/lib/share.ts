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

// One letter per shot in the shared card's URL (/c/214/KBAOK). Yards follow
// from the tiers, so the code is the whole card.
const CODE: Record<ShotTierId, string> = {
	BALL_KNOWER: 'K',
	ALL_STAR: 'A',
	STARTER: 'S',
	ROLE_PLAYER: 'R',
	BENCH_WARMER: 'B',
	OUT_OF_BOUNDS: 'O'
};
const MAX_SHOTS = 9;

export function cardCode(tiers: ShotTierId[]): string {
	return tiers.map((t) => CODE[t]).join('');
}

/** The tiers in a card code, or null if it isn't one. */
export function parseCardCode(code: string): ShotTierId[] | null {
	if (code.length < 1 || code.length > MAX_SHOTS) return null;
	const byLetter = Object.fromEntries(Object.entries(CODE).map(([t, c]) => [c, t])) as Record<
		string,
		ShotTierId
	>;
	const tiers = [...code.toUpperCase()].map((c) => byLetter[c]);
	return tiers.every(Boolean) ? tiers : null;
}

/** The shared card's page: shows the card in link previews (OG image), then invites a round. */
export function cardUrl(origin: string, holeNo: number, tiers: ShotTierId[]): string {
	return `${origin}/c/${holeNo}/${cardCode(tiers)}`;
}

export function shareHeadline(holeNo: number, total: number): string {
	return `BALL KNOWER #${holeNo} · ${total} YDS`;
}

export function shareText(holeNo: number, total: number, tiers: ShotTierId[], url: string): string {
	return [shareHeadline(holeNo, total), tiers.map((t) => SQUARE[t]).join(''), url].join('\n');
}

export function tiersLabel(tiers: ShotTierId[]): string {
	return `Shot tiers: ${tiers.map((t) => tierInfo(t).label).join(', ')}`;
}
