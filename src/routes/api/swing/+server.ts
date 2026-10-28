import { error, json } from '@sveltejs/kit';
import { bindings, jsonBody, playerId } from '#lib/server/env.ts';
import { swing } from '#lib/server/plays.ts';
import { allow } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const player = playerId(request);
	if (!allow(`ip:${getClientAddress()}`, 120) || !allow(`player:${player}`, 30)) {
		error(429, 'Too many requests');
	}
	const { holeNo, index, entityId, rawText } = await jsonBody(request);
	if (
		typeof holeNo !== 'number' ||
		typeof index !== 'number' ||
		(entityId !== null && typeof entityId !== 'string') ||
		typeof rawText !== 'string'
	) {
		error(400, 'Expected { holeNo, index, entityId, rawText }');
	}
	const result = await swing(bindings(), player, { holeNo, index, entityId, rawText });
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
