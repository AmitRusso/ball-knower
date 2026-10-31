import { error } from '@sveltejs/kit';
import { jsonBody } from '#lib/server/env.ts';
import { clientReport, logError } from '#lib/server/log.ts';
import { allow } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

// Uncaught browser errors, sent by src/hooks.client.ts with sendBeacon.
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allow(`log:${getClientAddress()}`, 10)) error(429, 'Too many reports');
	const report = clientReport(await jsonBody(request));
	if (!report) error(400, 'Expected { message, stack?, path? }');
	const err = Object.assign(new Error(report.message), { stack: report.stack });
	logError('client', err, { path: report.path });
	return new Response(null, { status: 204 });
};
