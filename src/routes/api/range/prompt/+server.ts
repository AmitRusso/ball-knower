import { json } from '@sveltejs/kit';
import { bindings } from '#lib/server/env.ts';
import { MAX_SEEN, rangePrompt } from '#lib/server/range.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const seen = (url.searchParams.get('seen') ?? '')
		.split(',')
		.map(Number)
		.filter(Number.isInteger)
		.slice(0, MAX_SEEN);
	const prompt = await rangePrompt(bindings(), seen);
	return json(prompt, { headers: { 'cache-control': 'no-store' } });
};
