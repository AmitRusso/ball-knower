import { error, json } from '@sveltejs/kit';
import { bindings, playerId } from '#lib/server/env.ts';
import { answers } from '#lib/server/plays.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	const holeNo = Number(params.holeNo);
	if (!Number.isInteger(holeNo)) error(400, 'Bad hole number');
	// Without a player id only past holes are open.
	const player = request.headers.has('x-player-id') ? playerId(request) : null;
	const result = await answers(bindings(), player, holeNo);
	return json(result, { headers: { 'cache-control': 'private, no-store' } });
};
