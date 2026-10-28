import { describe, expect, it } from 'vitest';
import hole from '../../data/sample-hole.json';
import { createMatcher, jaroWinkler, normalize } from './match';
import type { Entity } from './types';

const pools = hole.pools as Record<string, { entities: Entity[] }>;
const matcher = (poolId: string) => createMatcher(pools[poolId].entities);

describe('normalize', () => {
	it.each([
		['  The Boston Celtics ', 'boston celtics'],
		['Nikola Jokić', 'nikola jokic'],
		['O.J. Simpson', 'oj simpson'],
		["Shaquille O'Neal", 'shaquille oneal'],
		['Trail-Blazers', 'trail blazers'],
		['Ole Gunnar Solskjær', 'ole gunnar solskjaer'],
		['ŁUKASZ', 'lukasz']
	])('%s → %s', (input, expected) => {
		expect(normalize(input)).toBe(expected);
	});
});

describe('jaroWinkler', () => {
	it('scores the classic example', () => {
		expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
	});
	it('is 0 for nothing in common', () => {
		expect(jaroWinkler('abc', 'xyz')).toBe(0);
	});
});

describe('every name and alias in the sample hole resolves to its entity', () => {
	for (const [poolId, pool] of Object.entries(pools)) {
		const m = matcher(poolId);
		for (const entity of pool.entities) {
			for (const text of [entity.name, ...(entity.aliases ?? [])]) {
				it(`${poolId}: "${text}" → ${entity.id}`, () => {
					expect(m.match(text)?.id).toBe(entity.id);
				});
			}
		}
	}
});

describe('forgiving input', () => {
	it.each([
		['nba-franchises', 'san antonio spur', 'nba-san-antonio-spurs'],
		['nba-franchises', 'SAN ANTONIO', 'nba-san-antonio-spurs'],
		['nba-franchises', 'minneapolis lakers', 'nba-los-angeles-lakers'],
		['nba-franchises', 'celtics', 'nba-boston-celtics'],
		['nba-franchises', 'golden st', 'nba-golden-state-warriors'],
		['nba-players', 'nikola jokic', 'nba-nikola-jokic'],
		['nba-players', 'westbrok', 'nba-russell-westbrook'],
		['nfl-players', 'mark mosely', 'nfl-mark-moseley'],
		['nfl-players', 'moseley', 'nfl-mark-moseley'],
		['mlb-pitchers', 'cy yung', 'mlb-cy-young'],
		['countries', 'usa', 'ctry-united-states'],
		['countries', 'the netherlands', 'ctry-netherlands']
	])('%s: "%s" → %s', (poolId, query, id) => {
		expect(matcher(poolId).match(query)?.id).toBe(id);
	});

	it('suggests nothing for a single letter or nonsense', () => {
		const m = matcher('nba-franchises');
		expect(m.match('s')).toBeNull();
		expect(m.match('zzqx')).toBeNull();
	});
});

describe('no correctness leak', () => {
	it('suggests wrong answers from the pool just as readily', () => {
		// Argentina is in the countries pool but never hosted the Summer Games.
		expect(matcher('countries').match('argentina')?.id).toBe('ctry-argentina');
	});

	it('breaks ties alphabetically, not by pool order', () => {
		const a: Entity = { id: 'z', name: 'Zed Brown' };
		const b: Entity = { id: 'a', name: 'Al Brown' };
		expect(createMatcher([a, b]).match('brown')?.id).toBe('a');
		expect(createMatcher([b, a]).match('brown')?.id).toBe('a');
	});
});
