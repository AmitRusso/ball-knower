import { expect, it } from 'vitest';
import hole from '../../data/sample-hole.json';
import { TODAY } from './today';

it('matches data/sample-hole.json', () => {
	expect(TODAY).toEqual({ holeNo: hole.holeNo, date: hole.date, prompts: hole.prompts.length });
});
