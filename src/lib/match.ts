// Auto-correct: one closest match from the WHOLE entity pool (hard rule 2).
// Runs in the browser on every keystroke, and on the server for raw-text swings (M2).

import type { Entity } from './types';

export const SUGGEST_THRESHOLD = 0.88;
const MIN_QUERY_LENGTH = 2;
const MIN_PREFIX_LENGTH = 3;

// Letters NFD doesn't decompose into base + mark.
const FOLD: Record<string, string> = { ø: 'o', ł: 'l', đ: 'd', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };

/** lowercase, strip accents, drop punctuation, collapse spaces, drop a leading "the". */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[øłđæœßþ]/g, (c) => FOLD[c])
		.replace(/['’.]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.replace(/^the /, '');
}

export function jaroWinkler(a: string, b: string): number {
	if (a === b) return 1;
	if (!a.length || !b.length) return 0;
	const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
	const aHit = new Array<boolean>(a.length).fill(false);
	const bHit = new Array<boolean>(b.length).fill(false);
	let matches = 0;
	for (let i = 0; i < a.length; i++) {
		const lo = Math.max(0, i - window);
		const hi = Math.min(b.length - 1, i + window);
		for (let j = lo; j <= hi; j++) {
			if (!bHit[j] && a[i] === b[j]) {
				aHit[i] = bHit[j] = true;
				matches++;
				break;
			}
		}
	}
	if (!matches) return 0;
	let transpositions = 0;
	for (let i = 0, j = 0; i < a.length; i++) {
		if (!aHit[i]) continue;
		while (!bHit[j]) j++;
		if (a[i] !== b[j++]) transpositions++;
	}
	const m = matches;
	const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
	let prefix = 0;
	while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
	return jaro + prefix * 0.1 * (1 - jaro);
}

interface Key {
	key: string;
	tokens: string[];
	entity: Entity;
}

export interface Matcher {
	match(query: string): Entity | null;
}

/** Score one normalized query against one normalized key (name or alias). */
function score(q: string, k: Key): number {
	if (q === k.key) return 1;
	let best = jaroWinkler(q, k.key);
	// Still typing: "san anto" → "san antonio spurs".
	if (q.length >= MIN_PREFIX_LENGTH && k.key.startsWith(q)) {
		best = Math.max(best, 0.9 + 0.09 * (q.length / k.key.length));
	}
	// One word that is (or starts, or nearly spells) a word of the name: "moseley", "celtics".
	if (!q.includes(' ')) {
		for (const t of k.tokens) {
			if (t === q) best = Math.max(best, 0.95);
			else if (q.length >= MIN_PREFIX_LENGTH && t.startsWith(q)) best = Math.max(best, 0.9);
			else best = Math.max(best, jaroWinkler(q, t) * 0.97);
		}
	}
	return best;
}

/**
 * Build a matcher over a pool. Ties break alphabetically by canonical name: the
 * sample pools carry no popularity data, and pool order must never be used
 * because it may correlate with correctness.
 */
export function createMatcher(entities: Entity[]): Matcher {
	const sorted = [...entities].sort((a, b) => a.name.localeCompare(b.name));
	const keys: Key[] = [];
	const exact = new Map<string, Entity>();
	for (const entity of sorted) {
		for (const raw of [entity.name, ...(entity.aliases ?? [])]) {
			const key = normalize(raw);
			if (!key) continue;
			keys.push({ key, tokens: key.split(' '), entity });
			if (!exact.has(key)) exact.set(key, entity);
		}
	}

	return {
		match(query) {
			const q = normalize(query);
			if (q.length < MIN_QUERY_LENGTH) return null;
			const hit = exact.get(q);
			if (hit) return hit;
			let best: Entity | null = null;
			let bestScore = SUGGEST_THRESHOLD;
			for (const k of keys) {
				const s = score(q, k);
				if (s > bestScore || (s === bestScore && best === null)) {
					best = k.entity;
					bestScore = s;
				}
			}
			return best;
		}
	};
}
