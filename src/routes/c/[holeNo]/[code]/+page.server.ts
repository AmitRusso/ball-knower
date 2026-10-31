import { error } from '@sveltejs/kit';
import { cardTotal } from '#lib/server/og.ts';
import { parseCardCode } from '#lib/share.ts';
import type { PageServerLoad } from './$types';

// A shared card: rendered on the server so link previews get the OG tags.
export const load: PageServerLoad = ({ params, url, setHeaders }) => {
	const holeNo = Number(params.holeNo);
	const tiers = parseCardCode(params.code);
	if (!Number.isInteger(holeNo) || holeNo < 1 || !tiers) error(404, 'No such card');
	setHeaders({ 'cache-control': 'public, max-age=86400' });
	return {
		holeNo,
		tiers,
		total: cardTotal(tiers),
		image: `${url.origin}/og/${holeNo}/${params.code.toUpperCase()}.png`,
		url: url.href
	};
};
