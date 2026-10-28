import { error, json } from '@sveltejs/kit';
import { bindings, jsonBody, playerId } from '#lib/server/env.ts';
import { startPrompt } from '#lib/server/plays.ts';
import { allow } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const player = playerId(request);
	if (!allow(`ip:${getClientAddress()}`, 120) || !allow(`player:${player}`, 30)) {
		error(429, 'Too many requests');
	}
	const { holeNo } = await jsonBody(request);
	if (typeof holeNo !== 'number') error(400, 'holeNo is required');
	const result = await startPrompt(bindings(), player, holeNo, Number(params.index));
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
