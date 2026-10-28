// Best-effort fixed-window limiter, per Worker isolate. Pages Functions have no
// rate-limiting binding (docs/06-decisions.md, D15); a WAF rate-limiting rule on
// /api/* is the production backstop.

const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

const windows = new Map<string, { start: number; count: number }>();

export function allow(key: string, limitPerMinute: number, now = Date.now()): boolean {
	if (windows.size > MAX_KEYS) {
		for (const [k, w] of windows) if (now - w.start >= WINDOW_MS) windows.delete(k);
	}
	const w = windows.get(key);
	if (!w || now - w.start >= WINDOW_MS) {
		windows.set(key, { start: now, count: 1 });
		return true;
	}
	return ++w.count <= limitPerMinute;
}
