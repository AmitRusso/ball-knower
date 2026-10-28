<script lang="ts">
	// The shot result, revealed Krillion/Farflung style: the ball carries past
	// each tier gate while the stamp upgrades, then the stamp slams down, the
	// card flashes in the tier color and the flavor line appears.
	import type { Snippet } from 'svelte';
	import FairwayTracker, { type TrackedShot } from '#lib/components/FairwayTracker.svelte';
	import type { Shot } from '#lib/play.ts';
	import {
		CARRY_MAX,
		easeOut,
		flavor,
		flightMs,
		GATES,
		gateReached,
		SETTLE_DELAY_MS,
		STAMP_DELAY_MS
	} from '#lib/reveal.ts';
	import { HOLE_LENGTH_YDS, OUT_OF_BOUNDS, TIER_CLASS, tierInfo } from '#lib/scoring.ts';
	import type { ShotTierId } from '#lib/types.ts';

	interface Props {
		shot: Shot;
		/** Yardage the shot starts from. */
		start: number;
		/** Earlier shots, for the tracker. */
		past: TrackedShot[];
		promptText: string;
		onsettled: () => void;
		/** NEXT SHOT and friends, placed at the end of the panel. */
		actions?: Snippet;
	}

	let { shot, start, past, promptText, onsettled, actions }: Props = $props();

	const OB_CARRY = 30;
	const isOB = $derived(shot.tier === OUT_OF_BOUNDS.id);

	let progress = $state(0);
	let phase = $state<'flight' | 'stamped' | 'settled'>('flight');

	const carry = $derived((isOB ? OB_CARRY : shot.yards) * progress);
	const stamp: ShotTierId | null = $derived(
		phase === 'flight' ? gateReached(isOB ? 0 : carry) : shot.tier
	);
	const shownYds = $derived(phase === 'flight' ? Math.round(isOB ? 0 : carry) : shot.yards);
	const tier = $derived(tierInfo(shot.tier));
	const flight = $derived<TrackedShot>({ start, yards: shot.yards, tier: shot.tier });

	const gx = (yds: number) => 8 + yds * (326 / CARRY_MAX);

	$effect(() => {
		const timers: ReturnType<typeof setTimeout>[] = [];
		const settle = () => {
			phase = 'settled';
			onsettled();
		};
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			progress = 1;
			phase = 'stamped';
			settle();
			return;
		}
		const duration = flightMs(shot.yards, shot.tier);
		const t0 = performance.now();
		let frame = requestAnimationFrame(function step(now) {
			progress = easeOut((now - t0) / duration);
			if (progress < 1) {
				frame = requestAnimationFrame(step);
				return;
			}
			timers.push(
				setTimeout(() => {
					phase = 'stamped';
					timers.push(setTimeout(settle, SETTLE_DELAY_MS));
				}, STAMP_DELAY_MS)
			);
		});
		return () => {
			cancelAnimationFrame(frame);
			timers.forEach(clearTimeout);
		};
	});
</script>

<!-- Mobile: one column (card, carry, fairway, flavor, actions). Desktop: the
     fairway and carry meter form the stage; the card, flavor and actions the panel. -->
<div class="reveal">
	<div class="stage">
		<div class="fairway-slot">
			<FairwayTracker
				shots={past}
				mode="result"
				{flight}
				{progress}
				label="The ball flies {shot.yards} yards, to {start + shot.yards} of {HOLE_LENGTH_YDS}"
			/>
		</div>
		<div class="meter" aria-hidden="true">
			<svg viewBox="0 0 342 50" width="100%">
				<text class="caption" x="8" y="8">CARRY</text>
				<line class="track" x1="8" y1="24" x2="334" y2="24" />
				{#each GATES as gate, i (gate.id)}
					{@const x = gx(gate.yards)}
					{@const lit = !isOB && carry >= gate.yards - 0.5}
					{@const last = i === GATES.length - 1}
					<g
						class="gate tier-{TIER_CLASS[gate.id]}"
						class:lit
						class:landed={lit && phase !== 'flight' && gate.id === shot.tier}
					>
						<line x1={x} y1="15" x2={x} y2="33" />
						<text {x} y={i % 2 ? 9 : 45} text-anchor={last ? 'end' : 'middle'} dx={last ? 4 : 0}
							>{gate.label.toUpperCase()}</text
						>
					</g>
				{/each}
				<circle class="ball" cx={gx(carry)} cy="24" r="5" />
				{#if isOB && phase !== 'flight'}
					<line class="cross" x1={gx(OB_CARRY) - 4} y1="20" x2={gx(OB_CARRY) + 4} y2="28" />
					<line class="cross" x1={gx(OB_CARRY) + 4} y1="20" x2={gx(OB_CARRY) - 4} y2="28" />
				{/if}
			</svg>
		</div>
	</div>
	<div class="panel">
		<div
			class="trading-card"
			class:flash={phase !== 'flight'}
			style:--flash="var(--bk-tier-{TIER_CLASS[shot.tier]}-bg)"
		>
			<div class="frame tier-border-{TIER_CLASS[shot.tier]}">
				<p class="your">YOUR ANSWER</p>
				<h1 class:struck={isOB && shot.answer}>
					{shot.answer || (shot.timedOut ? 'Time ran out' : 'No answer')}
				</h1>
				<p class="reminder">{promptText}</p>
				<div
					class="stamp {stamp ? `tier-bg-${TIER_CLASS[stamp]}` : 'empty'}"
					class:slam={phase !== 'flight'}
					data-testid="stamp"
				>
					<div class="tier-name">{stamp ? tierInfo(stamp).label.toUpperCase() : '· · ·'}</div>
					<div class="yds">+{shownYds} YDS</div>
				</div>
			</div>
		</div>
		<p class="flavor" class:show={phase === 'settled'}>
			{flavor(shot.tier, { timedOut: shot.timedOut, blank: !shot.rawText })}
		</p>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
	<p class="sr-only" aria-live="polite">
		{#if phase === 'settled'}{tier.label}. Plus {tier.yards} yards. {start + shot.yards} of {HOLE_LENGTH_YDS}.{/if}
	</p>
</div>

<style>
	.reveal {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.stage,
	.panel {
		display: contents;
	}

	.trading-card {
		order: 1;
	}
	.meter {
		order: 2;
	}
	.fairway-slot {
		order: 3;
	}
	.flavor {
		order: 4;
	}
	.actions {
		order: 5;
		margin-top: auto;
		min-height: 66px;
	}

	.trading-card {
		margin-top: 4px;
		padding: 6px;
		background: var(--bk-cream);
		border-radius: 8px;
		box-shadow: 0 5px 0 var(--bk-green-900);
	}

	.trading-card.flash {
		animation: flash 450ms ease-out;
	}

	@keyframes flash {
		from {
			box-shadow:
				0 5px 0 var(--bk-green-900),
				0 0 0 14px var(--flash);
		}
		to {
			box-shadow:
				0 5px 0 var(--bk-green-900),
				0 0 0 0 var(--flash);
		}
	}

	.frame {
		overflow: hidden;
		padding: 16px 16px 0;
		border: 3px solid;
		border-radius: 5px;
		color: var(--bk-ink);
		text-align: center;
	}

	.tier-border-knower {
		border-color: var(--bk-tier-knower-bg);
	}
	.tier-border-allstar {
		border-color: var(--bk-tier-allstar-bg);
	}
	.tier-border-starter {
		border-color: var(--bk-tier-starter-bg);
	}
	.tier-border-role {
		border-color: var(--bk-tier-role-bg);
	}
	.tier-border-bench {
		border-color: var(--bk-tier-bench-bg);
	}
	.tier-border-ob {
		border-color: var(--bk-tier-ob-bg);
	}

	.your {
		margin: 0;
		font-family: var(--bk-font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--bk-ink-muted);
	}

	h1 {
		margin: 8px 0 0;
		font-size: 30px;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.struck {
		text-decoration: line-through;
	}

	.reminder {
		margin: 6px 0 0;
		font-size: 13px;
		color: var(--bk-ink-muted);
	}

	.stamp {
		margin: 16px -16px 0;
		padding: 14px 0 16px;
		transition: background-color 120ms;
	}

	.stamp.empty {
		color: var(--bk-ink-muted);
		background: repeating-linear-gradient(
			135deg,
			var(--bk-cream-200) 0 8px,
			var(--bk-cream) 8px 16px
		);
	}

	.stamp.slam .tier-name {
		animation: slam 220ms cubic-bezier(0.3, 1.6, 0.6, 1);
	}

	@keyframes slam {
		from {
			transform: scale(1.5) rotate(-4deg);
			opacity: 0.4;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	.tier-name {
		font-family: var(--bk-font-display);
		font-size: 38px;
		line-height: 1;
	}

	.yds {
		margin-top: 8px;
		font-family: var(--bk-font-display);
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}

	.tier-bg-allstar .yds {
		color: var(--bk-gold);
	}

	.meter {
		padding: 8px 12px 4px;
		background: var(--bk-green-800);
		border: 2px solid var(--bk-green-500);
		border-radius: var(--bk-radius-card);
	}

	svg {
		display: block;
		overflow: visible;
	}

	.caption {
		font-family: var(--bk-font-mono);
		font-size: 10px;
		font-weight: 700;
		fill: var(--bk-gold);
		letter-spacing: 0.1em;
	}

	.track {
		stroke: var(--bk-green-500);
		stroke-width: 6;
		stroke-linecap: round;
	}

	.gate {
		--c: var(--bk-cream);
		opacity: 0.4;
		transition: opacity 120ms;
	}

	.gate.lit {
		opacity: 1;
	}

	.gate line {
		stroke: var(--c);
		stroke-width: 2;
		stroke-dasharray: 3 2;
	}

	.gate text {
		font-family: var(--bk-font-mono);
		font-size: 9.5px;
		font-weight: 700;
		fill: var(--c);
	}

	.gate.lit.tier-knower {
		--c: var(--bk-gold);
	}
	.gate.lit.tier-allstar {
		--c: var(--bk-arc-allstar);
	}
	.gate.lit.tier-starter {
		--c: var(--bk-arc-starter);
	}
	.gate.lit.tier-role {
		--c: var(--bk-tier-role-bg);
	}

	.gate.landed line {
		stroke-width: 3;
		stroke-dasharray: none;
	}

	.ball {
		fill: var(--bk-cream);
		stroke: var(--bk-green-900);
		stroke-width: 2;
	}

	.cross {
		stroke: var(--bk-arc-ob);
		stroke-width: 2.5;
	}

	.flavor {
		margin: 0;
		min-height: 1.4em;
		font-size: 14px;
		font-weight: 600;
		text-align: center;
		opacity: 0;
		transition: opacity 300ms;
	}

	.flavor.show {
		opacity: 1;
	}

	@media (min-width: 960px) {
		.reveal {
			display: grid;
			grid-template-columns: minmax(0, 1fr) var(--bk-panel-width);
			column-gap: 40px;
			align-items: start;
		}

		.stage,
		.panel {
			display: flex;
			flex-direction: column;
			gap: 16px;
		}

		.panel {
			align-self: stretch;
		}

		.reveal > * > * {
			order: 0;
		}

		.reveal {
			align-content: center;
		}

		.flavor {
			text-align: left;
		}

		.actions {
			margin-top: 8px;
		}
	}
</style>
