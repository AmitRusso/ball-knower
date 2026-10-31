// Driving Range state: one ball at a time from past holes. Nothing here
// touches the daily play, streaks or stats; only the recently seen prompt ids
// and the session's tally go to localStorage.

import * as api from './api';
import { createMatcher, type Matcher } from './match';
import type { Shot } from './play';
import { readJSON, RANGE_KEY, writeJSON } from './storage';
import type { Entity, RangePrompt } from './types';

/** How many recent prompts to skip before repeats are allowed. */
const SEEN_MAX = 50;

interface Saved {
	seen: number[];
	balls: number;
	yards: number;
}

export class Range {
	prompt = $state<RangePrompt | null>(null);
	matcher = $state<Matcher | null>(null);
	draft = $state('');
	/** Epoch ms when the clock started; null while teeing up. */
	startedAt = $state<number | null>(null);
	shot = $state<Shot | null>(null);
	answers = $state<{ entityId: string; name: string }[]>([]);
	swinging = $state(false);
	saved = $state<Saved>({ seen: [], balls: 0, yards: 0 });

	suggestion: Entity | null = $derived(this.matcher?.match(this.draft) ?? null);

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain cache, deliberately not reactive
	#pools = new Map<string, Promise<Matcher>>();

	/** Tee up the next ball. */
	async next(): Promise<void> {
		this.saved = readJSON(RANGE_KEY, this.saved);
		const prompt = await api.getRangePrompt(this.saved.seen);
		this.shot = null;
		this.answers = [];
		this.draft = '';
		this.startedAt = null;
		this.matcher = null;
		this.prompt = prompt;
		const { poolId, poolVersion } = prompt;
		let pending = this.#pools.get(poolId);
		if (!pending) {
			pending = api.getPool(poolId, poolVersion).then((pool) => createMatcher(pool.entities));
			pending.catch(() => this.#pools.delete(poolId));
			this.#pools.set(poolId, pending);
		}
		const matcher = await pending;
		if (this.prompt?.poolId === poolId) this.matcher = matcher;
	}

	startClock(now = Date.now()): void {
		this.startedAt = now;
	}

	async swing(timedOut = false): Promise<void> {
		const prompt = this.prompt;
		if (!prompt || this.shot || this.swinging) return;
		this.swinging = true;
		try {
			const rawText = this.draft.trim();
			const entityId = rawText ? (this.suggestion?.id ?? null) : null;
			const result = await api.rangeSwing({ promptId: prompt.promptId, entityId, rawText });
			this.answers = result.answers;
			this.shot = {
				index: 0,
				rawText,
				entityId: result.entityId,
				answer: result.canonicalName,
				tier: result.tier,
				yards: result.yards,
				timedOut
			};
			this.saved = {
				seen: [prompt.promptId, ...this.saved.seen.filter((id) => id !== prompt.promptId)].slice(
					0,
					SEEN_MAX
				),
				balls: this.saved.balls + 1,
				yards: this.saved.yards + result.yards
			};
			writeJSON(RANGE_KEY, this.saved);
		} finally {
			this.swinging = false;
		}
	}
}
