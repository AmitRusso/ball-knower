import type { HandleServerError } from '@sveltejs/kit/hooks';
import { logError } from '#lib/server/log.ts';

// Log real bugs only; error(4xx) from our own code and 404s are expected.
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	logError('server', error, { method: event.request.method, path: event.url.pathname });
};
