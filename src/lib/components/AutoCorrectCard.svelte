<script lang="ts">
	import type { Entity } from '#lib/types.ts';

	let { entity, id }: { entity: Entity | null; id: string } = $props();
</script>

<!-- Always rendered so screen readers hear changes; hidden visually when there's no match. -->
<div {id} class="autocorrect" class:empty={!entity} aria-live="polite">
	{#if entity}
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M5 12l5 5L20 7" />
		</svg>
		<div>
			<div class="label">AUTO-CORRECT</div>
			<div class="name">
				{entity.name}{#if entity.hint}<span class="hint">· {entity.hint}</span>{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.autocorrect {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 62px;
		padding: 10px 14px;
		border: 2px dashed var(--bk-gold);
		border-radius: var(--bk-radius-card);
		background: var(--bk-green-800);
	}

	.autocorrect.empty {
		visibility: hidden;
	}

	svg {
		flex: none;
		fill: none;
		stroke: var(--bk-gold);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.label {
		font-family: var(--bk-font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--bk-tracking-label);
		color: var(--bk-gold);
	}

	.name {
		margin-top: 2px;
		font-size: 17px;
		font-weight: 800;
	}

	.hint {
		margin-left: 0.35em;
		font-size: 13px;
		font-weight: 600;
		opacity: 0.8;
	}
</style>
