<script lang="ts" module>
	import type { ShotTierId } from '#lib/types.ts';

	export interface TrackedShot {
		start: number;
		yards: number;
		tier: ShotTierId;
	}
</script>

<script lang="ts">
	import {
		arcPath,
		GROUND_Y,
		OB_LINE_Y,
		obArc,
		PIN_X,
		pointOnArc,
		shotArc,
		TEE_X,
		VIEW_WIDTH,
		yardsToX,
		type Arc
	} from '#lib/geometry.ts';
	import { HOLE_LENGTH_YDS, TIER_CLASS } from '#lib/scoring.ts';

	interface Props {
		/** Shots already played (not animated). */
		shots: TrackedShot[];
		/** prompt/result: dashed past arcs and yard markers; card: tier-colored hole map. */
		mode: 'prompt' | 'result' | 'card';
		/** Result screen: the shot to fly. */
		flight?: TrackedShot;
		/** How far along its arc the flight is, 0–1 (driven by ShotReveal). */
		progress?: number;
		label?: string;
	}

	let { shots, mode, flight, progress = 1, label }: Props = $props();

	const MARKERS = [100, 200, 300, 400];

	const arcFor = (s: TrackedShot): Arc =>
		s.tier === 'OUT_OF_BOUNDS' ? obArc(s.start) : shotArc(s.start, s.start + s.yards);

	const landed = $derived(progress >= 1);

	const flightArc = $derived(flight ? arcFor(flight) : null);
	const restingYds = $derived.by(() => {
		const all = flight ? [...shots, flight] : shots;
		return all.reduce((sum, s) => sum + s.yards, 0);
	});
	const startYds = $derived(flight ? flight.start : restingYds);
	const shownYds = $derived(flight ? Math.round(startYds + flight.yards * progress) : restingYds);
	// An OB ball flies its arc, then drops back where it was (stroke and distance).
	const ball = $derived(
		flightArc && !(flight?.tier === 'OUT_OF_BOUNDS' && landed)
			? pointOnArc(flightArc, progress)
			: { x: yardsToX(restingYds), y: GROUND_Y }
	);
	const height = $derived(mode === 'card' ? 124 : 110);
	const ariaLabel = $derived(
		label ??
			`Fairway: ball at ${restingYds} of ${HOLE_LENGTH_YDS} yards after ${shots.length + (flight ? 1 : 0)} shots`
	);
</script>

<div class="tracker" class:card={mode === 'card'}>
	{#if mode !== 'card'}
		<div class="header">
			{#if flight}
				<span><span class="from">{startYds} →</span> <span class="gold">{shownYds} YDS</span></span>
			{:else}
				<span class="gold">{shownYds} YDS</span>
			{/if}
			<span>{HOLE_LENGTH_YDS - shownYds} TO PIN</span>
		</div>
	{/if}

	<svg viewBox="0 0 {VIEW_WIDTH} {height}" width="100%" role="img" aria-label={ariaLabel}>
		<rect class="fairway" x="0" y={GROUND_Y - 10} width={VIEW_WIDTH} height="20" rx="10" />

		{#if mode === 'card'}
			<line class="ob-line" x1="0" y1={OB_LINE_Y} x2={VIEW_WIDTH} y2={OB_LINE_Y} />
			<text class="label" x="4" y="118">OB</text>
		{:else}
			{#each MARKERS as yds (yds)}
				<line class="tick" x1={yardsToX(yds)} y1="86" x2={yardsToX(yds)} y2="90" />
				<text class="label" x={yardsToX(yds)} y="102" text-anchor="middle">{yds}</text>
			{/each}
		{/if}

		<rect class="tee" x={TEE_X - 2} y={GROUND_Y - 6} width="4" height="12" />

		{#each shots as shot, i (i)}
			{@const arc = arcFor(shot)}
			<path
				class="arc tier-{TIER_CLASS[shot.tier]}"
				class:past={mode !== 'card'}
				d={arcPath(arc)}
			/>
			{#if shot.tier === 'OUT_OF_BOUNDS'}
				{@render cross(arc.to.x, arc.to.y)}
			{/if}
		{/each}

		{#if flight && flightArc}
			<path
				class="arc flight tier-{TIER_CLASS[flight.tier]}"
				d={arcPath(flightArc)}
				pathLength="1"
				style:stroke-dashoffset={1 - progress}
			/>
			{#if flight.tier === 'OUT_OF_BOUNDS'}
				{#if landed}{@render cross(flightArc.to.x, flightArc.to.y)}{/if}
			{:else}
				<ellipse class="shadow" cx={flightArc.to.x} cy={GROUND_Y + 2} rx="7" ry="2.5" />
			{/if}
		{/if}

		<line class="pole" x1={PIN_X} y1={GROUND_Y - 40} x2={PIN_X} y2={GROUND_Y} />
		<polygon
			class="flag"
			points="{PIN_X},{GROUND_Y - 40} {PIN_X + 14},{GROUND_Y - 34} {PIN_X},{GROUND_Y - 28}"
		/>
		<ellipse class="cup" cx={PIN_X} cy={GROUND_Y} rx="6" ry="2.5" />

		<circle class="ball" cx={ball.x} cy={ball.y} r="6" />
	</svg>
</div>

{#snippet cross(x: number, y: number)}
	<line class="cross" x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
	<line class="cross" x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
{/snippet}

<style>
	.tracker {
		background: var(--bk-green-800);
		border: 2px solid var(--bk-green-500);
		border-radius: var(--bk-radius-card);
		padding: 10px 12px 6px;
	}

	.tracker.card {
		background: none;
		border: none;
		padding: 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		font-family: var(--bk-font-mono);
		font-size: 13px;
		font-weight: 700;
	}

	.from {
		opacity: 0.7;
	}

	.gold {
		color: var(--bk-gold);
	}

	svg {
		display: block;
		overflow: visible;
	}

	.fairway {
		fill: var(--bk-green-500);
	}

	.tick {
		stroke: var(--bk-cream);
		stroke-opacity: 0.6;
	}

	.label {
		font-family: var(--bk-font-mono);
		font-size: 11px;
		fill: var(--bk-cream);
		fill-opacity: 0.8;
	}

	.ob-line {
		stroke: var(--bk-cream);
		stroke-width: 1.5;
		stroke-dasharray: 2 6;
	}

	.tee,
	.pole {
		fill: var(--bk-cream);
		stroke: var(--bk-cream);
	}

	.pole {
		stroke-width: 2;
	}

	.flag {
		fill: var(--bk-gold);
	}

	.cup {
		fill: var(--bk-green-900);
	}

	.arc {
		fill: none;
		stroke-width: 2.5;
	}

	.arc.past {
		stroke: var(--bk-cream);
		stroke-opacity: 0.55;
		stroke-width: 2;
		stroke-dasharray: 4 5;
	}

	.arc.tier-ob {
		stroke-dasharray: 4 4;
	}

	.arc.flight {
		stroke-width: 3;
		stroke-dasharray: 1;
		stroke-opacity: 1;
	}

	.tier-knower {
		stroke: var(--bk-gold);
	}
	.tier-allstar {
		stroke: var(--bk-arc-allstar);
	}
	.tier-starter {
		stroke: var(--bk-arc-starter);
	}
	.tier-role {
		stroke: var(--bk-tier-role-bg);
	}
	.tier-bench {
		stroke: var(--bk-tier-bench-bg);
	}
	.tier-ob {
		stroke: var(--bk-arc-ob);
	}

	.arc.flight:not(.tier-ob) {
		stroke: var(--bk-gold);
	}

	.cross {
		stroke: var(--bk-arc-ob);
		stroke-width: 2.5;
	}

	.shadow {
		fill: var(--bk-green-900);
		fill-opacity: 0.6;
	}

	.ball {
		fill: var(--bk-cream);
		stroke: var(--bk-green-900);
		stroke-width: 2;
	}
</style>
