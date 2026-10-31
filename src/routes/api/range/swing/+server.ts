import { error, json } from '@sveltejs/kit';
import { bindings, jsonBody } from '#lib/server/env.ts';
import { rangeSwing } from '#lib/server/range.ts';
import { allow } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allow(`range:${getClientAddress()}`, 120)) error(429, 'Too many requests');
	const { promptId, entityId, rawText } = await jsonBody(request);
	if (
		typeof promptId !== 'number' ||
		(entityId !== null && typeof entityId !== 'string') ||
		typeof rawText !== 'string'
	) {
		error(400, 'Expected { promptId, entityId, rawText }');
	}
	const result = await rangeSwing(bindings(), { promptId, entityId, rawText });
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
