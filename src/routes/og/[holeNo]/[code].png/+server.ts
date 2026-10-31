import { error } from '@sveltejs/kit';
import { renderCard } from '#lib/server/og.ts';
import { parseCardCode } from '#lib/share.ts';
import type { RequestHandler } from './$types';

// The image is a pure function of the URL, so it caches forever.
export const GET: RequestHandler = async ({ params }) => {
	const holeNo = Number(params.holeNo);
	const tiers = parseCardCode(params.code);
	if (!Number.isInteger(holeNo) || holeNo < 1 || !tiers) error(404, 'No such card');
	const png = await renderCard(holeNo, tiers);
	return new Response(png as BodyInit, {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};
