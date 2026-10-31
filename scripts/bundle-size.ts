// First-load JS per prerendered page, gzipped, against the budget in
// CLAUDE.md (hard rule 5: < 50 KB). Run after `pnpm build`:
//
//   node scripts/bundle-size.ts
//
// First-load JS is every script a page's HTML preloads or imports, plus their
// static imports, followed transitively. Lazy chunks (dynamic import()) don't count.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 50;
const OUT = '.svelte-kit/cloudflare';

const pages = readdirSync(OUT).filter((f) => f.endsWith('.html') && f !== '404.html');
if (pages.length === 0) throw new Error(`No pages in ${OUT}; run pnpm build first`);

const gz = new Map<string, number>();
function gzipped(file: string): number {
	let size = gz.get(file);
	if (size === undefined) {
		size = gzipSync(readFileSync(join(OUT, file)), { level: 9 }).length;
		gz.set(file, size);
	}
	return size;
}

/** Static imports of a built chunk: `import"./x.js"` and `from"./x.js"`, not `import("./x.js")`. */
function staticImports(file: string): string[] {
	const code = readFileSync(join(OUT, file), 'utf8');
	return [...code.matchAll(/(?:\bimport|\bfrom)\s*["']([^"']+\.js)["']/g)].map((m) =>
		posix.normalize(posix.join(dirname(file).replaceAll('\\', '/'), m[1]))
	);
}

let failed = false;
for (const page of pages) {
	const html = readFileSync(join(OUT, page), 'utf8');
	const roots = [
		...html.matchAll(/<link[^>]+href="\.?\/?([^"]+\.js)"[^>]*rel="modulepreload"/g),
		...html.matchAll(/import\("\.?\/?([^"]+\.js)"\)/g)
	].map((m) => posix.normalize(m[1]));

	const seen = new Set<string>();
	const queue = [...roots];
	while (queue.length) {
		const file = queue.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		queue.push(...staticImports(file));
	}
	const kb = [...seen].reduce((sum, f) => sum + gzipped(f), 0) / 1024;
	const over = kb >= BUDGET_KB;
	failed ||= over;
	console.log(
		`${over ? '✗' : '✓'} ${page.padEnd(18)} ${kb.toFixed(1).padStart(5)} KB gzipped JS (${seen.size} files)`
	);
}

if (failed) {
	console.error(`\nFirst-load JS budget is ${BUDGET_KB} KB gzipped (CLAUDE.md, hard rule 5).`);
	process.exit(1);
}
