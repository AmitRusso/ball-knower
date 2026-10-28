// Fairway tracker geometry (docs/02-design-system.md, "The tracker geometry").

import { HOLE_LENGTH_YDS } from './scoring';

export const VIEW_WIDTH = 342;
export const GROUND_Y = 74;
export const TEE_X = 12;
export const PIN_X = 326;
export const OB_LINE_Y = 98;
const OB_END_Y = 106;
const OB_CARRY_X = 33;

export interface Point {
	x: number;
	y: number;
}

export interface Arc {
	from: Point;
	control: Point;
	to: Point;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function yardsToX(yds: number): number {
	return round(TEE_X + Math.min(Math.max(yds, 0), HOLE_LENGTH_YDS) * 0.628);
}

/** Quadratic arc from `start` to `end` yards, raised in proportion to distance. */
export function shotArc(start: number, end: number): Arc {
	const x0 = yardsToX(start);
	const x1 = yardsToX(end);
	const peak = 10 + (end - start) * 0.2;
	return {
		from: { x: x0, y: GROUND_Y },
		control: { x: round((x0 + x1) / 2), y: round(GROUND_Y - 2 * peak) },
		to: { x: x1, y: GROUND_Y }
	};
}

/** An Out of Bounds shot hooks off the fairway and lands below the OB line. */
export function obArc(start: number): Arc {
	const x0 = yardsToX(start);
	const x1 = round(Math.min(x0 + OB_CARRY_X, VIEW_WIDTH - 6));
	return {
		from: { x: x0, y: GROUND_Y },
		control: { x: round(x0 + OB_CARRY_X / 2), y: 14 },
		to: { x: x1, y: OB_END_Y }
	};
}

export function arcPath({ from, control, to }: Arc): string {
	return `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`;
}

export function pointOnArc({ from, control, to }: Arc, t: number): Point {
	const u = 1 - t;
	return {
		x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
		y: u * u * from.y + 2 * u * t * control.y + t * t * to.y
	};
}
