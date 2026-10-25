const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "2026-10-25" → "SUN · OCT 25" (the hole's UTC date). */
export function holeDate(date: string, withDay = true): string {
	const d = new Date(`${date}T00:00:00Z`);
	const md = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
	return withDay ? `${DAYS[d.getUTCDay()]} · ${md}` : md;
}

/** Time until the next 00:00 UTC, as "HH:MM:SS". */
export function untilNextHole(now: number): string {
	const next = new Date(now);
	next.setUTCHours(24, 0, 0, 0);
	const s = Math.max(0, Math.floor((next.getTime() - now) / 1000));
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
