// Live pick counts, kept behind this interface so they can move into one
// Durable Object per hole if D1 write contention appears (docs/03-architecture.md, "Write load").

import type { Counts } from './rules';

export async function pickCounts(
	db: D1Database,
	promptId: number,
	entityId: string
): Promise<Counts> {
	const row = await db
		.prepare(
			`SELECT COALESCE(SUM(count), 0) AS total,
			        COALESCE(SUM(CASE WHEN entity_id = ?1 THEN count END), 0) AS count
			 FROM pick_counts WHERE prompt_id = ?2`
		)
		.bind(entityId, promptId)
		.first<Counts>();
	return row ?? { count: 0, total: 0 };
}

/**
 * Count one correct pick. Meant to run in a `db.batch()` straight after the
 * statement that locks the shot: it only counts if that statement changed a
 * row, so a replayed or concurrent swing never counts twice.
 */
export function recordPick(
	db: D1Database,
	promptId: number,
	entityId: string
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO pick_counts (prompt_id, entity_id, count)
			 SELECT ?1, ?2, 1 WHERE changes() = 1
			 ON CONFLICT (prompt_id, entity_id) DO UPDATE SET count = count + 1`
		)
		.bind(promptId, entityId);
}
