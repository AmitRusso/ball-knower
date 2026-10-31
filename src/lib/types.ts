// Shared payload types for the API in docs/03-architecture.md, imported by the
// endpoints under src/routes/api/ and by the client in src/lib/api.ts.

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
	version: number;
	entities: Entity[];
}

/** A prompt as sent to the browser before the hole is finished: no answers. */
export interface HolePrompt {
	index: number;
	text: string;
	note: string;
	league: string;
	poolId: string;
	/** Pool version: `GET /api/pool/:poolId?v=` with it is cached as immutable. */
	poolVersion: number;
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
	totalYards: number;
}

/** POST /api/prompt/:index/start */
export interface StartRequest {
	holeNo: number;
}

export interface StartResult {
	/** Time since the server first served this prompt; the client clock counts from it. */
	elapsedMs: number;
}

export interface PromptAnswers {
	index: number;
	answers: { entityId: string; name: string }[];
}

/** GET /api/range/prompt — a prompt from a past hole, for the Driving Range. */
export interface RangePrompt {
	promptId: number;
	holeNo: number;
	text: string;
	note: string;
	league: string;
	poolId: string;
	poolVersion: number;
}

/** POST /api/range/swing */
export interface RangeSwingRequest {
	promptId: number;
	entityId: string | null;
	rawText: string;
}

/** Scored like the hole was, but never counted. The answers are public once a hole is past. */
export interface RangeSwingResult {
	correct: boolean;
	canonicalName: string;
	entityId: string | null;
	tier: ShotTierId;
	yards: number;
	answers: { entityId: string; name: string }[];
}
