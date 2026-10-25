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
