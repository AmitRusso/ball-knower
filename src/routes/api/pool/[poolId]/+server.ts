import { error, json } from '@sveltejs/kit';
import { loadPool } from '#lib/server/content.ts';
import { bindings } from '#lib/server/env.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const v = url.searchParams.get('v');
	const version = v && /^\d+$/.test(v) ? Number(v) : undefined;
	const pool = await loadPool(bindings(), params.poolId, version);
	if (!pool) error(404, `No pool ${params.poolId}`);
	// Immutable only when the URL names the version served; otherwise it may change.
	const cache =
		pool.version === version ? 'public, max-age=31536000, immutable' : 'public, max-age=60';
	return json(pool, { headers: { 'cache-control': cache } });
};
