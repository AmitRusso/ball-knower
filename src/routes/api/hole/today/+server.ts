import { error, json } from '@sveltejs/kit';
import { currentHole } from '#lib/server/content.ts';
import { bindings } from '#lib/server/env.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const hole = await currentHole(bindings());
	if (!hole) error(404, 'No hole scheduled');
	return json(hole, { headers: { 'cache-control': 'public, max-age=60' } });
};
