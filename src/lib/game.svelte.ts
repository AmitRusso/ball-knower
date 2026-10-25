// Round state for the daily hole: wraps the pure helpers in play.ts with
// reactive state and localStorage persistence (resume mid-round, streaks).

import * as api from './api';
import { createMatcher, type Matcher } from './match';
import {
	EMPTY_STATS,
	isComplete,
	newPlay,
	recordCompletion,
	totalYards,
	utcDate,
	type Play,
	type Shot,
	type Stats
} from './play';
import { playKey, readJSON, STATS_KEY, writeJSON } from './storage';
import type { Entity, Hole } from './types';

export type Phase = 'prompt' | 'result' | 'done';

export class Game {
	hole = $state<Hole | null>(null);
	play = $state<Play>(newPlay(0));
	stats = $state<Stats>(EMPTY_STATS);
	/** Matcher for the current prompt's pool; null while the pool loads. */
	matcher = $state<Matcher | null>(null);
	swinging = $state(false);

	phase: Phase = $derived.by(() => {
		if (this.play.showingResult) return 'result';
		return this.hole && isComplete(this.play, this.hole.prompts.length) ? 'done' : 'prompt';
	});
	/** Index of the prompt being played (or whose result is showing). */
	index = $derived(this.play.showingResult ? this.play.shots.length - 1 : this.play.shots.length);
	prompt = $derived(this.hole?.prompts[this.index] ?? null);
	total = $derived(totalYards(this.play.shots));
	suggestion: Entity | null = $derived(this.matcher?.match(this.play.draft) ?? null);

	// Plain cache, deliberately not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	#pools = new Map<string, Promise<Matcher>>();

	async load(): Promise<void> {
		const hole = await api.getHole();
		this.play = readJSON(playKey(hole.holeNo), newPlay(hole.holeNo));
		this.stats = readJSON(STATS_KEY, EMPTY_STATS);
		this.hole = hole;
		await this.#loadMatcher();
	}

	/** Start the clock for the current prompt (no-op if it's already running). */
	servePrompt(now = Date.now()): void {
		if (this.phase !== 'prompt' || this.play.promptStartedAt !== null) return;
		this.play.promptStartedAt = now;
		this.#save();
	}

	setDraft(text: string): void {
		this.play.draft = text;
		this.#save();
	}

	/** Swing with the auto-corrected name, or the raw text when nothing matches. */
	async swing(timedOut = false): Promise<void> {
		const hole = this.hole;
		if (!hole || this.phase !== 'prompt' || this.swinging) return;
		this.swinging = true;
		try {
			const rawText = this.play.draft.trim();
			const entityId = rawText ? (this.suggestion?.id ?? null) : null;
			const result = rawText
				? await api.swing({ holeNo: hole.holeNo, index: this.index, entityId, rawText })
				: { canonicalName: '', tier: 'OUT_OF_BOUNDS' as const, yards: 0 };
			const shot: Shot = {
				index: this.index,
				rawText,
				entityId,
				answer: result.canonicalName,
				tier: result.tier,
				yards: result.yards,
				timedOut
			};
			this.play.shots.push(shot);
			this.play.showingResult = true;
			this.play.promptStartedAt = null;
			this.play.draft = '';
			if (isComplete(this.play, hole.prompts.length)) {
				this.stats = recordCompletion(this.stats, utcDate(Date.now()), this.play.shots);
				writeJSON(STATS_KEY, this.stats);
			}
			this.#save();
		} finally {
			this.swinging = false;
		}
	}

	async next(): Promise<void> {
		this.play.showingResult = false;
		this.#save();
		await this.#loadMatcher();
	}

	async #loadMatcher(): Promise<void> {
		const poolId = this.prompt?.poolId;
		if (!poolId || this.phase !== 'prompt') return;
		this.matcher = null;
		let pending = this.#pools.get(poolId);
		if (!pending) {
			pending = api.getPool(poolId).then((pool) => createMatcher(pool.entities));
			this.#pools.set(poolId, pending);
		}
		const matcher = await pending;
		if (this.prompt?.poolId === poolId) this.matcher = matcher;
	}

	#save(): void {
		writeJSON(playKey(this.play.holeNo), this.play);
	}
}
