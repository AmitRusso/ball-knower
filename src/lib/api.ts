// Client for the HTTP API in docs/03-architecture.md. Answer lists never come
// through here before the hole is finished (hard rule 1).

import { playerId } from './storage';
import type {
	Hole,
	Pool,
	PromptAnswers,
	RangePrompt,
	RangeSwingRequest,
	RangeSwingResult,
	StartRequest,
	StartResult,
	SwingRequest,
	SwingResult
} from './types';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
	const headers: Record<string, string> = { 'x-player-id': playerId() };
	if (init.body !== undefined) headers['content-type'] = 'application/json';
	const res = await fetch(path, {
		method: init.method ?? 'GET',
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body)
	});
	if (!res.ok) {
		const detail = await res.json().catch(() => null);
		throw new ApiError(
			res.status,
			(detail as { message?: string } | null)?.message ?? res.statusText
		);
	}
	return (await res.json()) as T;
}

/** GET /api/hole/today */
export const getHole = () => call<Hole>('/api/hole/today');

/** GET /api/pool/:poolId — immutable for a given version. */
export const getPool = (poolId: string, version: number) =>
	call<Pool>(`/api/pool/${encodeURIComponent(poolId)}?v=${version}`);

/** POST /api/prompt/:index/start — starts (or reports) the server-side clock. */
export const startPrompt = (holeNo: number, index: number) =>
	call<StartResult>(`/api/prompt/${index}/start`, {
		method: 'POST',
		body: { holeNo } satisfies StartRequest
	});

/** POST /api/swing */
export const swing = (req: SwingRequest) =>
	call<SwingResult>('/api/swing', { method: 'POST', body: req });

/** GET /api/hole/:holeNo/answers — 403 until this player has finished the hole. */
export const getAnswers = (holeNo: number) => call<PromptAnswers[]>(`/api/hole/${holeNo}/answers`);

/** GET /api/range/prompt — a random prompt from a past hole, skipping `seen` prompt ids. */
export const getRangePrompt = (seen: number[]) =>
	call<RangePrompt>(`/api/range/prompt?seen=${seen.join(',')}`);

/** POST /api/range/swing — scored, never counted; returns the prompt's answers. */
export const rangeSwing = (req: RangeSwingRequest) =>
	call<RangeSwingResult>('/api/range/swing', { method: 'POST', body: req });
