// localStorage can throw (private mode, blocked storage); the game must still
// work without it, just with no resume or streaks.

export function readJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

export function writeJSON(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage unavailable or full: keep playing in memory.
	}
}

export const playKey = (holeNo: number) => `bk:play:${holeNo}`;
export const STATS_KEY = 'bk:stats';
export const PLAYER_KEY = 'bk:player';

let sessionPlayer: string | undefined;

/** The player's random UUID (no accounts, no cookies). Lives for the session if storage is blocked. */
export function playerId(): string {
	try {
		let id = localStorage.getItem(PLAYER_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(PLAYER_KEY, id);
		}
		return id;
	} catch {
		return (sessionPlayer ??= crypto.randomUUID());
	}
}
