<script lang="ts">
	import { TIER_CLASS, tierInfo } from '#lib/scoring.ts';
	import type { ShotTierId } from '#lib/types.ts';

	let { tier }: { tier: ShotTierId } = $props();
</script>

<span class="chip tier-bg-{TIER_CLASS[tier]}">{tierInfo(tier).label.toUpperCase()}</span>

<style>
	.chip {
		justify-self: start;
		padding: 3px 7px;
		border-radius: var(--bk-radius-chip);
		font-family: var(--bk-font-mono);
		font-size: 11px;
		font-weight: 700;
		white-space: nowrap;
	}
</style>
