<script lang="ts">
	import { TIER_CLASS, tierInfo } from '#lib/scoring.ts';
	import type { ShotTierId } from '#lib/types.ts';

	interface Props {
		/** Tiers of the shots played so far, in order. */
		tiers: ShotTierId[];
		count: number;
		/** Index of the shot being played or revealed. */
		current: number;
	}

	let { tiers, count, current }: Props = $props();

	const label = $derived(
		`Shot ${current + 1} of ${count}` +
			(tiers.length ? `. So far: ${tiers.map((t) => tierInfo(t).label).join(', ')}` : '')
	);
</script>

<div class="pips" role="img" aria-label={label}>
	<div class="row">
		{#each { length: count }, i (i)}
			{@const tier = tiers[i]}
			<span
				class="pip {tier ? `tier-bg-${TIER_CLASS[tier]}` : ''}"
				class:current={i === current}
				class:played={tier !== undefined}
			></span>
		{/each}
	</div>
	<span class="caption">SHOT {current + 1} OF {count}</span>
</div>

<style>
	.pips {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.row {
		display: flex;
		gap: 5px;
	}

	.pip {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1.5px solid var(--bk-green-500);
	}

	.pip:not(.played) {
		background: var(--bk-green-800);
	}

	.pip.played {
		border-color: var(--bk-green-900);
	}

	.pip.current {
		width: 16px;
		height: 16px;
		margin-top: -2px;
		border: 2px solid var(--bk-gold);
	}

	.caption {
		font-family: var(--bk-font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--bk-tracking-label);
		color: var(--bk-gold);
	}
</style>
