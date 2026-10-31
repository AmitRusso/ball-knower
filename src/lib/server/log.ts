// Error logging: one JSON line per error on stderr, which Cloudflare keeps in
// the Pages Functions logs (`wrangler pages deployment tail`, or Workers Logs
// in the dashboard). No third-party service, and no player id in the line.

export type ErrorSource = 'server' | 'client';

const MAX_FIELD = 2_000;

const clip = (s: unknown) => (typeof s === 'string' ? s.slice(0, MAX_FIELD) : undefined);

export function logError(
	source: ErrorSource,
	error: unknown,
	context: Record<string, string | number | undefined> = {}
): void {
	const e = error instanceof Error ? error : null;
	console.error(
		JSON.stringify({
			level: 'error',
			source,
			message: clip(e?.message ?? String(error)),
			stack: clip(e?.stack),
			...context,
			at: new Date().toISOString()
		})
	);
}

/** A client report (POST /api/log), cut down to known string fields. */
export function clientReport(body: Record<string, unknown>): {
	message: string;
	stack?: string;
	path?: string;
} | null {
	const message = clip(body.message);
	if (!message) return null;
	return { message, stack: clip(body.stack), path: clip(body.path)?.slice(0, 200) };
}
