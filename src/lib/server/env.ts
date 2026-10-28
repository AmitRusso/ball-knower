import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';

export interface Bindings {
	db: D1Database;
	kv: KVNamespace;
}

/** D1 and KV from wrangler.jsonc. Under `pnpm dev` the adapter proxies the local state in .wrangler/. */
export function bindings(): Bindings {
	return { db: env.ball_knower, kv: env.HOLES };
}

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The client's random UUID from `X-Player-Id` (CLAUDE.md hard rule 7). */
export function playerId(request: Request): string {
	const id = request.headers.get('x-player-id');
	if (!id || !PLAYER_ID.test(id)) error(400, 'Missing or malformed X-Player-Id');
	return id.toLowerCase();
}

/** Parse a JSON body, turning anything unparseable into a 400. */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const body: unknown = await request.json();
		if (body && typeof body === 'object' && !Array.isArray(body)) {
			return body as Record<string, unknown>;
		}
	} catch {
		// fall through
	}
	error(400, 'Expected a JSON object body');
}
