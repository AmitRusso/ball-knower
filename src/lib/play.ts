// A player's round on one hole, and their local streak/stats. Pure functions;
// persistence lives in src/lib/game.svelte.ts.

import type { ShotTierId } from './types';

export interface Shot {
	index: number;
	rawText: string;
	entityId: string | null;
	/** Canonical name for a pool match, otherwise the raw text (or empty on a blank timeout). */
	answer: string;
	tier: ShotTierId;
	yards: number;
	timedOut: boolean;
}

export interface Play {
	holeNo: number;
	shots: Shot[];
	/** Epoch ms when the current prompt was served; the clock does not pause on reload. */
	promptStartedAt: number | null;
	/** True while the last shot's result screen is showing (before NEXT SHOT). */
	showingResult: boolean;
	draft: string;
}

export function newPlay(holeNo: number): Play {
	return { holeNo, shots: [], promptStartedAt: null, showingResult: false, draft: '' };
}

export function totalYards(shots: Shot[]): number {
	return shots.reduce((sum, s) => sum + s.yards, 0);
}

/** Yardage where each shot starts (an OB shot leaves the ball where it was). */
export function shotStarts(shots: Shot[]): number[] {
	let at = 0;
	return shots.map((s) => {
		const start = at;
		at += s.yards;
		return start;
	});
}

export function isComplete(play: Play, promptCount: number): boolean {
	return play.shots.length >= promptCount;
}

export function secondsLeft(startedAt: number, now: number, secondsPerPrompt: number): number {
	return Math.max(0, secondsPerPrompt - Math.floor((now - startedAt) / 1000));
}

export interface Stats {
	/** UTC date (YYYY-MM-DD) of the last completed daily hole. */
	lastPlayed: string | null;
	streak: number;
	played: number;
	bestCard: number;
	totalYards: number;
	ballKnowers: number;
}

export const EMPTY_STATS: Stats = {
	lastPlayed: null,
	streak: 0,
	played: 0,
	bestCard: 0,
	totalYards: 0,
	ballKnowers: 0
};

export function utcDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

function dayBefore(date: string): string {
	return utcDate(Date.parse(`${date}T00:00:00Z`) - 86_400_000);
}

export function recordCompletion(stats: Stats, today: string, shots: Shot[]): Stats {
	if (stats.lastPlayed === today) return stats;
	const total = totalYards(shots);
	return {
		lastPlayed: today,
		streak: stats.lastPlayed === dayBefore(today) ? stats.streak + 1 : 1,
		played: stats.played + 1,
		bestCard: Math.max(stats.bestCard, total),
		totalYards: stats.totalYards + total,
		ballKnowers: stats.ballKnowers + shots.filter((s) => s.tier === 'BALL_KNOWER').length
	};
}

/** The streak as of `today`: it lapses once a whole UTC day is missed. */
export function currentStreak(stats: Stats, today: string): number {
	if (stats.lastPlayed === today || stats.lastPlayed === dayBefore(today)) return stats.streak;
	return 0;
}
