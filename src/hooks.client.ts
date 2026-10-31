import type { HandleClientError } from '@sveltejs/kit/hooks';

// Uncaught browser errors go to POST /api/log (our own Worker logs; no
// third-party service, no player id). A few per page load at most.

let budget = 5;

function report(error: unknown): void {
	if (budget-- <= 0) return;
	const e = error instanceof Error ? error : null;
	const body = JSON.stringify({
		message: e?.message ?? String(error),
		stack: e?.stack,
		path: location.pathname
	});
	try {
		navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
	} catch {
		// Logging must never break the game.
	}
}

window.addEventListener('error', (event) => report(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => report(event.reason));

export const handleError: HandleClientError = ({ kind, error }) => {
	if (kind === 'unknown') report(error);
};
