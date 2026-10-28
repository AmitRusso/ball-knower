// Shared payload types. These mirror the API in docs/03-architecture.md so the
// M1 offline source (src/lib/api.ts) can be swapped for fetch calls in M2.

export type TierId = 'BALL_KNOWER' | 'ALL_STAR' | 'STARTER' | 'ROLE_PLAYER' | 'BENCH_WARMER';
export type ShotTierId = TierId | 'OUT_OF_BOUNDS';

export interface Entity {
	id: string;
	name: string;
	/** Disambiguator shown in the auto-correct card (league, team, era). */
	hint?: string;
	aliases?: string[];
}

export interface Pool {
	poolId: string;
	entities: Entity[];
}

/** A prompt as sent to the browser before the hole is finished: no answers. */
export interface HolePrompt {
	index: number;
	text: string;
	note: string;
	league: string;
	poolId: string;
}

export interface Hole {
	holeNo: number;
	date: string;
	lengthYds: number;
	secondsPerPrompt: number;
	prompts: HolePrompt[];
}

export interface SwingRequest {
	holeNo: number;
	index: number;
	entityId: string | null;
	rawText: string;
}

export interface SwingResult {
	correct: boolean;
	canonicalName: string;
	tier: ShotTierId;
	yards: number;
}

export interface PromptAnswers {
	index: number;
	answers: { entityId: string; name: string }[];
}
