// M1 stand-in for the HTTP API in docs/03-architecture.md, backed by
// data/sample-hole.json. M2 replaces each function body with a fetch to the
// matching endpoint; callers don't change.
//
// NOTE: in M1 the whole sample file (answers included) ships to the browser as
// a lazy chunk. That is the accepted offline-prototype exception to hard rule 1
// and goes away in M2, when answers stay on the server.

import { blendedShare, OUT_OF_BOUNDS, tierForShare } from './scoring';
import type { Entity, Hole, Pool, PromptAnswers, SwingRequest, SwingResult } from './types';

interface SampleHole {
	holeNo: number;
	date: string;
	lengthYds: number;
	secondsPerPrompt: number;
	prompts: {
		position: number;
		league: string;
		poolId: string;
		text: string;
		note: string;
		answers: { entityId: string; name: string; priorShare: number }[];
	}[];
	pools: Record<string, { name: string; entities: Entity[] }>;
}

let cached: Promise<SampleHole> | undefined;
const sample = () =>
	(cached ??= import('../../data/sample-hole.json').then((m) => m.default as SampleHole));

/** GET /api/hole/today */
export async function getHole(): Promise<Hole> {
	const h = await sample();
	return {
		holeNo: h.holeNo,
		date: h.date,
		lengthYds: h.lengthYds,
		secondsPerPrompt: h.secondsPerPrompt,
		prompts: h.prompts.map((p) => ({
			index: p.position,
			text: p.text,
			note: p.note,
			league: p.league,
			poolId: p.poolId
		}))
	};
}

/** GET /api/pool/:poolId */
export async function getPool(poolId: string): Promise<Pool> {
	const h = await sample();
	return { poolId, entities: h.pools[poolId]?.entities ?? [] };
}

/** POST /api/swing — tier comes from the prior alone until M2 has real pick counts. */
export async function swing(req: SwingRequest): Promise<SwingResult> {
	const h = await sample();
	const prompt = h.prompts.find((p) => p.position === req.index);
	if (!prompt || h.holeNo !== req.holeNo) throw new Error(`No prompt ${req.index}`);
	const answer = req.entityId ? prompt.answers.find((a) => a.entityId === req.entityId) : undefined;
	if (!answer) {
		const entity = h.pools[prompt.poolId]?.entities.find((e) => e.id === req.entityId);
		return {
			correct: false,
			canonicalName: entity?.name ?? req.rawText.trim(),
			tier: OUT_OF_BOUNDS.id,
			yards: OUT_OF_BOUNDS.yards
		};
	}
	const tier = tierForShare(blendedShare(0, 0, answer.priorShare));
	return { correct: true, canonicalName: answer.name, tier: tier.id, yards: tier.yards };
}

/** GET /api/hole/:holeNo/answers — callers must only ask once the play is complete. */
export async function getAnswers(holeNo: number): Promise<PromptAnswers[]> {
	const h = await sample();
	if (h.holeNo !== holeNo) throw new Error(`No hole ${holeNo}`);
	return h.prompts.map((p) => ({
		index: p.position,
		answers: p.answers
			.map(({ entityId, name }) => ({ entityId, name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	}));
}
