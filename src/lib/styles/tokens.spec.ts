import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('design tokens', () => {
	it('src copy matches design/tokens.css', () => {
		const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
		expect(read('src/lib/styles/tokens.css')).toBe(read('design/tokens.css'));
	});
});
