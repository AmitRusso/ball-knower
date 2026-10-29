// Helpers shared by the scripts that write SQL for `wrangler d1 execute`.

import { spawnSync } from 'node:child_process';

export type SqlValue = string | number | null | undefined;

export const q = (v: SqlValue) =>
	v === null || v === undefined
		? 'NULL'
		: typeof v === 'number'
			? String(v)
			: `'${v.replaceAll("'", "''")}'`;

export const row = (...values: SqlValue[]) => `(${values.map(q).join(', ')})`;

export function wrangler(...rest: string[]): string {
	const res = spawnSync('pnpm', ['exec', 'wrangler', ...rest], {
		shell: process.platform === 'win32',
		encoding: 'utf8',
		stdio: ['inherit', 'pipe', 'inherit']
	});
	if (res.status !== 0) throw new Error(`wrangler ${rest.join(' ')} failed:\n${res.stdout}`);
	return res.stdout;
}

/**
 * Run one read-only statement and return its rows. Uses --command: with
 * --remote, --file goes through D1's import API, which returns no rows. On
 * Windows the command runs through the shell, so it is quoted as one argument.
 */
export function query<T>(target: string, sql: string): T[] {
	const oneLine = sql.replace(/\s+/g, ' ').trim();
	if (oneLine.includes('"')) throw new Error('query() SQL must not contain double quotes');
	const command = process.platform === 'win32' ? `"${oneLine}"` : oneLine;
	const out = wrangler('d1', 'execute', 'ball-knower', target, '--json', `--command=${command}`);
	// wrangler may print progress lines before the JSON; it starts on its own line.
	const start = out.search(/^\[/m);
	const parsed = start < 0 ? null : (JSON.parse(out.slice(start)) as { results?: T[] }[]);
	const rows = parsed?.[0]?.results;
	// Never treat "no answer" as "no rows": load-content's safety checks rely on these.
	if (!Array.isArray(rows)) throw new Error(`No rows in wrangler output:\n${out}`);
	return rows;
}
